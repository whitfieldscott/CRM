import io
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import quote

import pandas as pd
import requests
from csv_sender import send_bulk_emails
from sms_sender import send_bulk_sms
from sms_service import TEST_SMS_TO, normalize_us_e164, twilio_configured
from database import SessionLocal, engine, Base
from email_service import FROM_EMAIL, SENDGRID_API_KEY, send_email
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from models import (
    CampaignLog,
    Client,
    ClientNote,
    Contact,
    EmailSendRecord,
    MarketingSuppressionFlag,
    SmsCampaignLog,
    Unsubscribe,
)
from analytics_schemas import (
    CampaignAnalyticsRow,
    EmailAnalyticsResponse,
    SendGridSeriesPoint,
    SendGridSeriesResponse,
    SendGridStatsResponse,
    SuppressionActionBody,
    SuppressionEntry,
    SuppressionListResponse,
    SmsSummaryAnalyticsResponse,
)
from schemas import (
    CSVImportSummary,
    TabularImportConfirmSummary,
    TabularImportPreviewResponse,
    TabularImportRow,
    CampaignLogCreate,
    CampaignLogResponse,
    CampaignSendBody,
    CampaignTemplateBody,
    ClientCreate,
    ClientNoteCreate,
    ClientNoteResponse,
    ClientResponse,
    ClientUpdate,
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    FromContactsBody,
    IntegerIdListBody,
    EmailSendResponse,
    SettingsResponse,
    SettingsUpdate,
    SmsCampaignLogResponse,
    SmsContactsResponse,
    SmsSendBody,
)
from settings_store import get_test_mode, set_test_mode
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

app = FastAPI(title="Rooted Dominion CRM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def normalize_csv_header(col: str) -> str:
    s = str(col).strip().lower().replace(".", "").replace(" ", "_").replace("-", "_")
    while "__" in s:
        s = s.replace("__", "_")
    return s


def load_and_clean_csv(file_path: str) -> pd.DataFrame:
    try:
        df = pd.read_csv(file_path)
        df.columns = [normalize_csv_header(c) for c in df.columns]

        if "email" not in df.columns:
            raise HTTPException(
                status_code=400,
                detail="CSV must contain an 'email' column (or column mappable to email)",
            )

        df["email"] = df["email"].astype(str).str.strip().str.lower()
        df = df[df["email"] != "nan"]
        df = df[df["email"].str.contains("@", na=False)]
        df = df.drop_duplicates(subset=["email"])

        return df

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {e}")


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
EMAIL_TEMPLATE_PATH = DATA_DIR / "email_template.html"

# Used only if data/email_template.html is missing (e.g. first deploy before file is created).
_FALLBACK_TEMPLATE_HTML = """<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:24px;font-family:system-ui,sans-serif;">
<p>Rooted Dominion — template file was not found. Save a draft from the Campaigns page
or add <code>data/email_template.html</code>.</p>
<p><a href="{{UNSUBSCRIBE_URL}}">Unsubscribe</a></p>
</body></html>"""


def read_email_template_string() -> str:
    if EMAIL_TEMPLATE_PATH.is_file():
        try:
            return EMAIL_TEMPLATE_PATH.read_text(encoding="utf-8")
        except OSError as e:
            raise HTTPException(
                status_code=500, detail=f"Could not read email template: {e}"
            )
    return _FALLBACK_TEMPLATE_HTML


def write_email_template_file(html: str) -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        EMAIL_TEMPLATE_PATH.write_text(html, encoding="utf-8")
    except OSError as e:
        raise HTTPException(
            status_code=500, detail=f"Could not save email template: {e}"
        )


def _safe_data_csv_file_name(name: str) -> str:
    n = (name or "").strip()
    if not n:
        raise HTTPException(status_code=400, detail="file_name is required")
    if ".." in n or "/" in n or "\\" in n:
        raise HTTPException(status_code=400, detail="Invalid file_name")
    return n


# Map normalized tabular import headers -> canonical column (name, business, phone, email)
TABULAR_COL_ALIASES = {
    "name": "name",
    "contact_name": "name",
    "full_name": "name",
    "business": "business",
    "company": "business",
    "business_name": "business",
    "organization": "business",
    "phone": "phone",
    "phone_number": "phone",
    "mobile": "phone",
    "email": "email",
    "e_mail": "email",
}


# Map normalized CSV column name -> Contact attribute name
IMPORT_COLUMN_MAP = {
    "email": "email",
    "business_name": "company",
    "company": "company",
    "name": "name",
    "contact_name": "name",
    "license_no": "license_number",
    "license_number": "license_number",
    "phone_number": "phone",
    "phone": "phone",
    "license_type": "license_type",
    "city": "city",
    "state": "state",
    "tags": "tags",
    "notes": "notes",
}


def _row_to_contact_attrs(row: pd.Series) -> dict:
    attrs = {}
    for col in row.index:
        key = str(col).strip().lower()
        field = IMPORT_COLUMN_MAP.get(key)
        if not field:
            continue
        val = row[col]
        if pd.isna(val):
            continue
        s = str(val).strip()
        if not s or s.lower() == "nan":
            continue
        attrs[field] = s
    return attrs


def _valid_email(email: str) -> bool:
    if not email or "@" not in email:
        return False
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email.strip()))


def _sendgrid_auth_headers() -> dict:
    return {"Authorization": f"Bearer {SENDGRID_API_KEY}"}


def _sendgrid_block_metrics(m: dict) -> dict:
    o = m.get("opens")
    if o is None:
        o = m.get("unique_opens")
    c = m.get("clicks")
    if c is None:
        c = m.get("unique_clicks")
    return {
        "requests": int(m.get("requests") or 0),
        "delivered": int(m.get("delivered") or 0),
        "bounces": int(m.get("bounces") or 0),
        "spam_reports": int(m.get("spam_reports") or 0),
        "unsubscribes": int(m.get("unsubscribes") or 0),
        "opens": int(o or 0),
        "clicks": int(c or 0),
    }


def _tabular_dataframe_from_bytes(raw: bytes, filename: str) -> pd.DataFrame:
    name = (filename or "").lower()
    bio = io.BytesIO(raw)
    if name.endswith(".xlsx"):
        try:
            df = pd.read_excel(bio, engine="openpyxl")
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Could not read Excel file: {e}"
            ) from e
    else:
        try:
            bio.seek(0)
            df = pd.read_csv(bio)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not read CSV: {e}") from e

    df.columns = [normalize_csv_header(str(c)) for c in df.columns]
    canon_src: dict[str, str] = {}
    for col in df.columns:
        target = TABULAR_COL_ALIASES.get(col)
        if target and target not in canon_src:
            canon_src[target] = col
    if "email" not in canon_src:
        raise HTTPException(
            status_code=400,
            detail="File must include an Email column (or mappable header like email, e_mail).",
        )
    out = pd.DataFrame()
    for key in ("name", "business", "phone", "email"):
        if key in canon_src:
            out[key] = df[canon_src[key]]
        else:
            out[key] = None
    return out


def _tabular_rows_from_df(df: pd.DataFrame) -> tuple[list[TabularImportRow], int, int]:
    total_rows = int(len(df))
    rows: list[TabularImportRow] = []
    skipped = 0
    seen: set[str] = set()
    for _, r in df.iterrows():
        raw_email = r.get("email")
        if raw_email is None or (isinstance(raw_email, float) and pd.isna(raw_email)):
            skipped += 1
            continue
        email = str(raw_email).strip().lower()
        if not _valid_email(email):
            skipped += 1
            continue
        if email in seen:
            continue
        seen.add(email)

        def cell(k: str) -> Optional[str]:
            v = r.get(k)
            if v is None or (isinstance(v, float) and pd.isna(v)):
                return None
            s = str(v).strip()
            return s if s and s.lower() != "nan" else None

        rows.append(
            TabularImportRow(
                name=cell("name"),
                business=cell("business"),
                phone=cell("phone"),
                email=email,
            )
        )
    return rows, total_rows, skipped


def _format_sendgrid_suppression_date(val) -> str:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    if isinstance(val, (int, float)):
        try:
            return datetime.utcfromtimestamp(int(val)).strftime("%Y-%m-%d %H:%M UTC")
        except (ValueError, OSError):
            return str(int(val))
    s = str(val).strip()
    if s.isdigit():
        try:
            return datetime.utcfromtimestamp(int(s)).strftime("%Y-%m-%d %H:%M UTC")
        except (ValueError, OSError):
            return s
    return s


def _follow_up_emails_for_kind(db: Session, kind: str) -> set[str]:
    q = (
        db.query(MarketingSuppressionFlag.email)
        .filter(
            MarketingSuppressionFlag.kind == kind,
            MarketingSuppressionFlag.action == "follow_up",
        )
        .distinct()
    )
    return {e[0].lower() for e in q.all() if e[0]}


@app.on_event("startup")
def _startup():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}


@app.get("/settings", response_model=SettingsResponse)
def get_settings():
    return SettingsResponse(
        from_email=FROM_EMAIL,
        sendgrid_configured=bool(SENDGRID_API_KEY),
        test_mode=get_test_mode(),
    )


@app.put("/settings", response_model=SettingsResponse)
def update_settings(body: SettingsUpdate):
    set_test_mode(body.test_mode)
    return get_settings()


@app.get("/test-email")
def test_email():
    send_email(
        to_email="admin@arkonesystems.com",
        subject="Test Email",
        content="<strong>This is a test email</strong>",
    )
    return {"status": "Test email sent"}


BULK_EMAIL_SUBJECT = "Available Clones — Rooted Dominion | Rooted & Ready $5 Each"


@app.post("/send-bulk")
def send_bulk(
    file_name: str,
    campaign_name: Optional[str] = None,
    test_email: Optional[str] = None,
    db: Session = Depends(get_db),
):
    file_path = f"../data/{file_name}"

    df = load_and_clean_csv(file_path)

    name = campaign_name or f"Bulk: {file_name}"
    campaign = CampaignLog(
        campaign_name=name,
        file_used=file_name,
        total_sent=0,
        total_failed=0,
        total_skipped=0,
        date_sent=datetime.utcnow(),
    )
    db.add(campaign)
    db.flush()
    db.refresh(campaign)

    try:
        result = send_bulk_emails(
            df,
            file_name=file_name,
            db=db,
            campaign_log_id=campaign.id,
            email_subject=BULK_EMAIL_SUBJECT,
            test_email_override=(test_email.strip() if test_email else None),
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Send failed: {e}")

    campaign.total_sent = result.get("sent", 0)
    campaign.total_failed = result.get("failed", 0)
    campaign.total_skipped = result.get("skipped", 0)
    db.commit()
    db.refresh(campaign)

    return {
        "message": "Emails sent",
        "total_in_file": len(df),
        "campaign_log_id": campaign.id,
        "result": result,
    }


@app.get("/preview-csv")
def preview_csv(file_name: str):
    file_path = f"../data/{file_name}"
    df = load_and_clean_csv(file_path)
    preview_data = df.head(5).to_dict(orient="records")
    return {
        "total_rows": len(df),
        "columns": list(df.columns),
        "preview": preview_data,
    }


@app.get("/confirm-send")
def confirm_send(file_name: str):
    file_path = f"../data/{file_name}"
    df = load_and_clean_csv(file_path)
    return {
        "file_name": file_name,
        "total_valid_emails": len(df),
        "sample_emails": df["email"].head(5).tolist(),
        "ready_to_send": True,
    }


def _sms_warmup_meta() -> dict:
    from csv_sender import WARMUP_SCHEDULE, WARMUP_START_DATE

    today = datetime.now()
    d = (today - WARMUP_START_DATE).days + 1
    if d < 1:
        d = 1
    if d > 21:
        return {"warmup_day": d, "daily_limit": 999999, "warmup_complete": True}
    return {
        "warmup_day": d,
        "daily_limit": WARMUP_SCHEDULE.get(d, 200),
        "warmup_complete": False,
    }


def _sms_contacts_dataframe(file_path: str) -> tuple[pd.DataFrame, dict]:
    """Return deduped dataframe with E.164 `phone` column and size stats."""
    df0 = load_and_clean_csv(file_path)
    total_rows_in_file = len(df0)
    phone_col = None
    for name in ("phone", "phone_number", "mobile", "cell"):
        if name in df0.columns:
            phone_col = name
            break
    if not phone_col:
        raise HTTPException(
            status_code=400,
            detail="CSV must include a phone column (phone, phone_number, mobile, or cell).",
        )
    norm = df0[phone_col].map(normalize_us_e164)
    valid_mask = norm.notna()
    rows_without_valid_phone = int((~valid_mask).sum())
    sub = df0[valid_mask].copy()
    sub["phone"] = norm[valid_mask]
    sub = sub.drop_duplicates(subset=["phone"])
    meta = {
        "total_rows_in_file": total_rows_in_file,
        "rows_without_valid_phone": rows_without_valid_phone,
        "unique_valid_phones": len(sub),
    }
    return sub, meta


@app.get("/sms/contacts", response_model=SmsContactsResponse)
def get_sms_contacts(file_name: str):
    """Valid phone numbers from a CSV in /data (same list as email blaster)."""
    safe = _safe_data_csv_file_name(file_name)
    path = f"../data/{safe}"
    warmup = _sms_warmup_meta()
    try:
        df_valid, meta = _sms_contacts_dataframe(path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    sample = df_valid["phone"].head(5).astype(str).tolist()

    return SmsContactsResponse(
        file_name=safe,
        total_rows_in_file=meta["total_rows_in_file"],
        total_valid_phones=meta["unique_valid_phones"],
        rows_without_valid_phone=meta["rows_without_valid_phone"],
        sample_phones=sample,
        daily_limit=warmup["daily_limit"],
        warmup_day=warmup["warmup_day"],
        warmup_complete=warmup["warmup_complete"],
        test_mode=get_test_mode(),
        twilio_configured=twilio_configured(),
        test_sms_to_configured=bool((TEST_SMS_TO or "").strip()),
    )


@app.post("/sms/send")
def send_sms_campaign(payload: SmsSendBody, db: Session = Depends(get_db)):
    if not twilio_configured():
        raise HTTPException(
            status_code=503,
            detail="Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env.",
        )
    sms_test_e164: Optional[str] = None
    if payload.sms_test_mode:
        raw_dest = (payload.sms_test_destination or "").strip() or (
            TEST_SMS_TO or ""
        ).strip()
        if not raw_dest:
            raise HTTPException(
                status_code=400,
                detail="SMS test mode requires a test phone number in the request or TEST_SMS_TO in .env.",
            )
        sms_test_e164 = normalize_us_e164(raw_dest)
        if not sms_test_e164:
            raise HTTPException(
                status_code=400,
                detail="Invalid test phone number. Use US 10-digit or E.164 (+1…).",
            )

    safe = _safe_data_csv_file_name(payload.file_name)
    path = f"../data/{safe}"
    try:
        df, meta = _sms_contacts_dataframe(path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if len(df) == 0:
        raise HTTPException(
            status_code=400, detail="No contacts with valid phone numbers in this file.",
        )

    name = (payload.campaign_name or "").strip() or f"SMS: {safe}"
    log = SmsCampaignLog(
        campaign_name=name,
        file_used=safe,
        total_sent=0,
        total_failed=0,
        total_skipped=0,
        date_sent=datetime.utcnow(),
    )
    db.add(log)
    db.flush()
    db.refresh(log)

    try:
        result = send_bulk_sms(
            df,
            file_name=safe,
            message=payload.message.strip(),
            db=db,
            sms_campaign_log_id=log.id,
            sms_test_mode=payload.sms_test_mode,
            sms_test_destination=sms_test_e164 if payload.sms_test_mode else None,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"SMS send failed: {e}")

    log.total_sent = result.get("sent", 0)
    log.total_failed = result.get("failed", 0)
    log.total_skipped = result.get("skipped", 0)
    db.commit()
    db.refresh(log)

    return {
        "message": "SMS campaign finished",
        "total_in_file": meta["unique_valid_phones"],
        "sms_campaign_log_id": log.id,
        "result": result,
    }


@app.get("/sms/history", response_model=list[SmsCampaignLogResponse])
def list_sms_campaign_history(db: Session = Depends(get_db)):
    return (
        db.query(SmsCampaignLog)
        .order_by(SmsCampaignLog.date_sent.desc(), SmsCampaignLog.id.desc())
        .all()
    )


# --- Contacts ---


@app.post("/contacts", response_model=ContactResponse)
def create_contact(payload: ContactCreate, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    existing = db.query(Contact).filter(Contact.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Contact with this email already exists")

    c = Contact(
        name=payload.name,
        email=email,
        phone=payload.phone,
        company=payload.company,
        license_number=payload.license_number,
        license_type=payload.license_type,
        city=payload.city,
        state=payload.state or "OK",
        tags=payload.tags,
        notes=payload.notes,
        is_active=payload.is_active,
    )
    db.add(c)
    try:
        db.commit()
        db.refresh(c)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return c


@app.get("/contacts", response_model=list[ContactResponse])
def list_contacts(
    license_type: Optional[str] = None,
    tags: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
):
    q = db.query(Contact)

    if active_only:
        q = q.filter(Contact.is_active.is_(True))

    if license_type:
        lt = license_type.strip().lower()
        q = q.filter(func.lower(Contact.license_type) == lt)

    if tags:
        t = tags.strip().lower()
        q = q.filter(
            Contact.tags.isnot(None),
            func.lower(Contact.tags).like(f"%{t}%"),
        )

    if search:
        term = f"%{search.strip().lower()}%"
        q = q.filter(
            or_(
                func.lower(Contact.name).like(term),
                func.lower(Contact.email).like(term),
                func.lower(Contact.company).like(term),
            )
        )

    return q.order_by(Contact.created_at.desc(), Contact.id.desc()).all()


@app.get("/contacts/{contact_id}", response_model=ContactResponse)
def get_contact(contact_id: int, db: Session = Depends(get_db)):
    c = db.query(Contact).filter(Contact.id == contact_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    return c


@app.put("/contacts/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: int, payload: ContactUpdate, db: Session = Depends(get_db)
):
    c = db.query(Contact).filter(Contact.id == contact_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")

    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"]).strip().lower()
        taken = (
            db.query(Contact)
            .filter(Contact.email == data["email"], Contact.id != contact_id)
            .first()
        )
        if taken:
            raise HTTPException(status_code=400, detail="Email already in use")

    for k, v in data.items():
        setattr(c, k, v)

    try:
        db.commit()
        db.refresh(c)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return c


@app.delete("/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    c = db.query(Contact).filter(Contact.id == contact_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(c)
    db.commit()
    return {"message": "Contact deleted", "id": contact_id}


@app.post("/contacts/bulk-delete")
def bulk_delete_contacts(body: IntegerIdListBody, db: Session = Depends(get_db)):
    deleted = 0
    for cid in body.ids:
        row = db.query(Contact).filter(Contact.id == cid).first()
        if row:
            db.delete(row)
            deleted += 1
    db.commit()
    return {"deleted": deleted}


@app.post("/clients/from-contacts")
def create_clients_from_contacts(
    body: FromContactsBody, db: Session = Depends(get_db)
):
    created = 0
    skipped = 0
    for cid in body.contact_ids:
        contact = db.query(Contact).filter(Contact.id == cid).first()
        if not contact:
            continue
        email = contact.email.strip().lower()
        exists = (
            db.query(Client)
            .filter(func.lower(Client.primary_contact_email) == email)
            .first()
        )
        if exists:
            skipped += 1
            continue
        client_name = (
            (contact.company or contact.name or email.split("@")[0]).strip()[:255]
            or "Client"
        )
        db.add(
            Client(
                name=client_name,
                primary_contact_email=email,
                primary_contact_name=contact.name,
                primary_contact_phone=contact.phone,
                state=contact.state or "OK",
                city=contact.city,
                license_number=contact.license_number,
                license_type=contact.license_type,
            )
        )
        created += 1
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"created": created, "skipped_existing": skipped}


@app.post("/contacts/import-csv", response_model=CSVImportSummary)
async def import_contacts_csv(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    try:
        raw = await file.read()
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {e}")

    df.columns = [normalize_csv_header(c) for c in df.columns]

    if "email" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="CSV must include an email column (e.g. 'email')",
        )

    df["_email_norm"] = df["email"].astype(str).str.strip().str.lower()
    df = df[df["_email_norm"] != "nan"]
    df = df[df["_email_norm"].str.contains("@", na=False)]
    df = df.drop_duplicates(subset=["_email_norm"], keep="last")

    added = updated = skipped_invalid = 0

    for _, row in df.iterrows():
        email = row["_email_norm"]
        if not _valid_email(email):
            skipped_invalid += 1
            continue

        attrs = _row_to_contact_attrs(row.drop(labels=["_email_norm"], errors="ignore"))
        attrs["email"] = email

        existing = db.query(Contact).filter(Contact.email == email).first()
        if existing:
            for key, val in attrs.items():
                if key == "email":
                    continue
                if val is not None and str(val).strip():
                    setattr(existing, key, val)
            updated += 1
        else:
            c = Contact(
                email=email,
                name=attrs.get("name"),
                phone=attrs.get("phone"),
                company=attrs.get("company"),
                license_number=attrs.get("license_number"),
                license_type=attrs.get("license_type"),
                city=attrs.get("city"),
                state=attrs.get("state") or "OK",
                tags=attrs.get("tags"),
                notes=attrs.get("notes"),
            )
            db.add(c)
            added += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {e}")

    return CSVImportSummary(
        added=added,
        updated=updated,
        skipped_invalid=skipped_invalid,
        total_rows_processed=int(len(df)),
    )


# --- Clients ---


@app.post("/clients", response_model=ClientResponse)
def create_client(payload: ClientCreate, db: Session = Depends(get_db)):
    c = Client(
        name=payload.name,
        license_number=payload.license_number,
        license_type=payload.license_type,
        primary_contact_name=payload.primary_contact_name,
        primary_contact_email=(
            payload.primary_contact_email.strip().lower()
            if payload.primary_contact_email
            else None
        ),
        primary_contact_phone=payload.primary_contact_phone,
        address=payload.address,
        city=payload.city,
        state=payload.state or "OK",
        notes=payload.notes,
        is_active=payload.is_active,
    )
    db.add(c)
    try:
        db.commit()
        db.refresh(c)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return c


@app.get("/clients", response_model=list[ClientResponse])
def list_clients(active_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(Client)
    if active_only:
        q = q.filter(Client.is_active.is_(True))
    return q.order_by(Client.name.asc()).all()


@app.get("/clients/{client_id}", response_model=ClientResponse)
def get_client(client_id: int, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    return c


@app.put("/clients/{client_id}", response_model=ClientResponse)
def update_client(client_id: int, payload: ClientUpdate, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")

    data = payload.model_dump(exclude_unset=True)
    if "primary_contact_email" in data and data["primary_contact_email"]:
        data["primary_contact_email"] = data["primary_contact_email"].strip().lower()

    for k, v in data.items():
        setattr(c, k, v)

    try:
        db.commit()
        db.refresh(c)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return c


@app.delete("/clients/{client_id}")
def delete_client(client_id: int, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    c.is_active = False
    db.commit()
    return {"message": "Client deactivated", "id": client_id}


@app.post("/clients/bulk-deactivate")
def bulk_deactivate_clients(body: IntegerIdListBody, db: Session = Depends(get_db)):
    rows = db.query(Client).filter(Client.id.in_(body.ids)).all()
    for c in rows:
        c.is_active = False
    db.commit()
    return {"updated": len(rows)}


@app.get("/clients/{client_id}/emails", response_model=list[EmailSendResponse])
def client_emails(client_id: int, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    rows = (
        db.query(EmailSendRecord)
        .filter(EmailSendRecord.client_id == client_id)
        .order_by(EmailSendRecord.sent_at.desc(), EmailSendRecord.id.desc())
        .all()
    )
    return rows


@app.get("/clients/{client_id}/campaigns", response_model=list[CampaignLogResponse])
def client_campaign_history(client_id: int, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = (
        db.query(EmailSendRecord.campaign_log_id)
        .filter(
            EmailSendRecord.client_id == client_id,
            EmailSendRecord.campaign_log_id.isnot(None),
        )
        .distinct()
        .all()
    )
    ids = [x[0] for x in sub if x[0]]
    if not ids:
        return []
    logs = (
        db.query(CampaignLog)
        .filter(CampaignLog.id.in_(ids))
        .order_by(CampaignLog.date_sent.desc(), CampaignLog.id.desc())
        .all()
    )
    return logs


@app.post("/clients/{client_id}/notes", response_model=ClientNoteResponse)
def add_client_note(
    client_id: int, payload: ClientNoteCreate, db: Session = Depends(get_db)
):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")

    n = ClientNote(client_id=client_id, note=payload.note.strip())
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


@app.get("/clients/{client_id}/notes", response_model=list[ClientNoteResponse])
def list_client_notes(client_id: int, db: Session = Depends(get_db)):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    notes = (
        db.query(ClientNote)
        .filter(ClientNote.client_id == client_id)
        .order_by(ClientNote.created_at.desc(), ClientNote.id.desc())
        .all()
    )
    return notes


# --- Campaigns (template + logs; static paths before /campaigns/{id}) ---


@app.get("/campaigns", response_model=list[CampaignLogResponse])
def list_campaigns(db: Session = Depends(get_db)):
    return (
        db.query(CampaignLog)
        .order_by(CampaignLog.date_sent.desc(), CampaignLog.id.desc())
        .all()
    )


@app.get("/campaigns/template")
def get_campaign_email_template():
    """Return saved HTML from data/email_template.html, or fallback if missing."""
    return {"html": read_email_template_string()}


@app.post("/campaigns/template")
def save_campaign_email_template(payload: CampaignTemplateBody):
    write_email_template_file(payload.html)
    return {"success": True}


@app.post("/campaigns/send")
def send_campaign_with_template(payload: CampaignSendBody, db: Session = Depends(get_db)):
    """
    Load HTML from data/email_template.html, send bulk (HTML body, not dynamic template),
    and update CampaignLog counts.
    """
    template_html = read_email_template_string()
    safe_name = _safe_data_csv_file_name(payload.file_name)
    file_path = f"../data/{safe_name}"
    df = load_and_clean_csv(file_path)

    name = payload.campaign_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="campaign_name is required")

    campaign = CampaignLog(
        campaign_name=name,
        file_used=safe_name,
        total_sent=0,
        total_failed=0,
        total_skipped=0,
        date_sent=datetime.utcnow(),
    )
    db.add(campaign)
    db.flush()
    db.refresh(campaign)

    try:
        te = (payload.test_email or "").strip().lower() if payload.test_email else None
        result = send_bulk_emails(
            df,
            file_name=safe_name,
            db=db,
            campaign_log_id=campaign.id,
            email_subject=name,
            html_content=template_html,
            test_email_override=te if te and "@" in te else None,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Send failed: {e}")

    campaign.total_sent = result.get("sent", 0)
    campaign.total_failed = result.get("failed", 0)
    campaign.total_skipped = result.get("skipped", 0)
    db.commit()
    db.refresh(campaign)

    return {
        "sent": campaign.total_sent,
        "failed": campaign.total_failed,
        "skipped": campaign.total_skipped,
        "campaign_log_id": campaign.id,
    }


@app.post("/campaigns/log", response_model=CampaignLogResponse)
def log_campaign(payload: CampaignLogCreate, db: Session = Depends(get_db)):
    log = CampaignLog(
        campaign_name=payload.campaign_name,
        file_used=payload.file_used,
        total_sent=payload.total_sent,
        total_failed=payload.total_failed,
        total_skipped=payload.total_skipped,
        date_sent=datetime.utcnow(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@app.get("/campaigns/{campaign_id}", response_model=CampaignLogResponse)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    log = db.query(CampaignLog).filter(CampaignLog.id == campaign_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Campaign log not found")
    return log


# --- Unsubscribe (existing) ---


@app.get("/unsubscribe")
def unsubscribe(email: str, db: Session = Depends(get_db)):
    existing = db.query(Unsubscribe).filter(
        Unsubscribe.email == email.lower().strip()
    ).first()

    if not existing:
        record = Unsubscribe(email=email.lower().strip())
        db.add(record)
        db.commit()

    return {
        "message": f"{email} has been unsubscribed successfully.",
        "status": "unsubscribed",
    }


@app.get("/unsubscribe-list")
def get_unsubscribes(db: Session = Depends(get_db)):
    records = db.query(Unsubscribe).all()
    return {
        "total": len(records),
        "emails": [r.email for r in records],
    }


@app.delete("/unsubscribe")
def remove_unsubscribe(email: str, db: Session = Depends(get_db)):
    record = db.query(Unsubscribe).filter(
        Unsubscribe.email == email.lower().strip()
    ).first()

    if record:
        db.delete(record)
        db.commit()
        return {"message": f"{email} removed from unsubscribe list"}

    return {"message": f"{email} was not on the unsubscribe list"}


# --- Marketing analytics ---


def _fetch_sendgrid_last_30_days() -> SendGridStatsResponse:
    zeros = {
        "opens": 0,
        "clicks": 0,
        "bounces": 0,
        "spam_reports": 0,
        "unsubscribes": 0,
        "delivered": 0,
        "requests": 0,
    }
    if not SENDGRID_API_KEY:
        return SendGridStatsResponse(**zeros, error="SENDGRID_API_KEY not configured")

    end_d = date.today()
    start_d = end_d - timedelta(days=29)
    url = (
        "https://api.sendgrid.com/v3/stats"
        f"?start_date={start_d.isoformat()}&end_date={end_d.isoformat()}&aggregated_by=day"
    )
    try:
        r = requests.get(url, headers=_sendgrid_auth_headers(), timeout=30)
        if r.status_code != 200:
            err = (r.text or "").strip()[:500] or f"SendGrid HTTP {r.status_code}"
            return SendGridStatsResponse(**zeros, error=err)
        payload = r.json()
    except Exception as e:
        return SendGridStatsResponse(**zeros, error=str(e)[:500])

    totals = dict(zeros)
    if isinstance(payload, list):
        for day in payload:
            for block in day.get("stats") or []:
                m = block.get("metrics") or {}
                part = _sendgrid_block_metrics(m)
                for k in totals:
                    totals[k] += part[k]

    return SendGridStatsResponse(**totals, error=None)


def _fetch_sendgrid_series(granularity: str) -> SendGridSeriesResponse:
    agg = {"day": "day", "week": "week", "month": "month"}.get(
        granularity, "day"
    )
    end_d = date.today()
    if agg == "day":
        start_d = end_d - timedelta(days=29)
    elif agg == "week":
        start_d = end_d - timedelta(days=83)
    else:
        start_d = end_d - timedelta(days=364)

    empty = SendGridSeriesResponse(granularity=granularity, points=[], error=None)
    if not SENDGRID_API_KEY:
        empty.error = "SENDGRID_API_KEY not configured"
        return empty

    url = (
        "https://api.sendgrid.com/v3/stats"
        f"?start_date={start_d.isoformat()}&end_date={end_d.isoformat()}&aggregated_by={agg}"
    )
    try:
        r = requests.get(url, headers=_sendgrid_auth_headers(), timeout=45)
        if r.status_code != 200:
            err = (r.text or "").strip()[:500] or f"SendGrid HTTP {r.status_code}"
            return SendGridSeriesResponse(
                granularity=granularity, points=[], error=err
            )
        payload = r.json()
    except Exception as e:
        return SendGridSeriesResponse(
            granularity=granularity, points=[], error=str(e)[:500]
        )

    points: list[SendGridSeriesPoint] = []
    if isinstance(payload, list):
        for bucket in payload:
            period = str(bucket.get("date") or "")
            d = o = cl = b = 0
            for block in bucket.get("stats") or []:
                m = block.get("metrics") or {}
                part = _sendgrid_block_metrics(m)
                d += part["delivered"]
                o += part["opens"]
                cl += part["clicks"]
                b += part["bounces"]
            if period:
                points.append(
                    SendGridSeriesPoint(
                        period=period,
                        delivered=d,
                        opens=o,
                        clicks=cl,
                        bounces=b,
                    )
                )

    return SendGridSeriesResponse(granularity=granularity, points=points, error=None)


def _sendgrid_suppression_fetch(kind: Literal["bounce", "unsubscribe"]) -> tuple[list, Optional[str]]:
    slug = "bounces" if kind == "bounce" else "unsubscribes"
    if not SENDGRID_API_KEY:
        return [], "SENDGRID_API_KEY not configured"
    url = f"https://api.sendgrid.com/v3/suppression/{slug}?limit=500"
    try:
        r = requests.get(url, headers=_sendgrid_auth_headers(), timeout=45)
        if r.status_code != 200:
            return [], (r.text or "").strip()[:500] or f"SendGrid HTTP {r.status_code}"
        data = r.json()
    except Exception as e:
        return [], str(e)[:500]
    if isinstance(data, list):
        return data, None
    if isinstance(data, dict) and isinstance(data.get("emails"), list):
        return data["emails"], None
    return [], "Unexpected SendGrid response shape"


def _sendgrid_suppression_delete(kind: Literal["bounce", "unsubscribe"], email: str) -> None:
    slug = "bounces" if kind == "bounce" else "unsubscribes"
    enc = quote(email.strip(), safe="")
    url = f"https://api.sendgrid.com/v3/suppression/{slug}/{enc}"
    r = requests.delete(url, headers=_sendgrid_auth_headers(), timeout=30)
    if r.status_code not in (200, 204):
        raise HTTPException(
            status_code=400,
            detail=(r.text or "").strip()[:500] or f"SendGrid HTTP {r.status_code}",
        )


@app.get("/analytics/email", response_model=EmailAnalyticsResponse)
def analytics_email_aggregate(db: Session = Depends(get_db)):
    total_sent = int(
        db.query(func.coalesce(func.sum(CampaignLog.total_sent), 0)).scalar() or 0
    )
    total_failed = int(
        db.query(func.coalesce(func.sum(CampaignLog.total_failed), 0)).scalar() or 0
    )
    total_skipped = int(
        db.query(func.coalesce(func.sum(CampaignLog.total_skipped), 0)).scalar() or 0
    )
    total_campaigns = int(db.query(func.count(CampaignLog.id)).scalar() or 0)
    total_contacts = int(db.query(func.count(Contact.id)).scalar() or 0)
    total_unsubscribes = int(db.query(func.count(Unsubscribe.id)).scalar() or 0)

    last_row = (
        db.query(CampaignLog.date_sent)
        .order_by(CampaignLog.date_sent.desc(), CampaignLog.id.desc())
        .first()
    )
    last_send_date = last_row[0] if last_row else None

    week_ago = datetime.utcnow() - timedelta(days=7)
    campaigns_this_week = (
        db.query(func.count(CampaignLog.id))
        .filter(
            and_(
                CampaignLog.date_sent.isnot(None),
                CampaignLog.date_sent >= week_ago,
            )
        )
        .scalar()
        or 0
    )
    campaigns_this_week = int(campaigns_this_week)

    average_send_size = (
        round(total_sent / total_campaigns, 1) if total_campaigns else 0.0
    )

    return EmailAnalyticsResponse(
        total_sent=total_sent,
        total_failed=total_failed,
        total_skipped=total_skipped,
        total_campaigns=total_campaigns,
        total_contacts=total_contacts,
        total_unsubscribes=total_unsubscribes,
        last_send_date=last_send_date,
        campaigns_this_week=campaigns_this_week,
        average_send_size=average_send_size,
    )


@app.get("/analytics/sms/summary", response_model=SmsSummaryAnalyticsResponse)
def analytics_sms_summary_aggregate(db: Session = Depends(get_db)):
    total_sent = int(
        db.query(func.coalesce(func.sum(SmsCampaignLog.total_sent), 0)).scalar() or 0
    )
    total_failed = int(
        db.query(func.coalesce(func.sum(SmsCampaignLog.total_failed), 0)).scalar() or 0
    )
    total_skipped = int(
        db.query(func.coalesce(func.sum(SmsCampaignLog.total_skipped), 0)).scalar() or 0
    )
    return SmsSummaryAnalyticsResponse(
        total_sent=total_sent,
        total_failed=total_failed,
        total_skipped=total_skipped,
    )


@app.get("/analytics/campaigns", response_model=list[CampaignAnalyticsRow])
def analytics_campaigns_list(db: Session = Depends(get_db)):
    rows = (
        db.query(CampaignLog)
        .order_by(CampaignLog.date_sent.desc(), CampaignLog.id.desc())
        .all()
    )
    out: list[CampaignAnalyticsRow] = []
    for c in rows:
        sent, failed = c.total_sent, c.total_failed
        denom = sent + failed
        delivery_rate = round(100.0 * sent / denom, 1) if denom else 0.0
        out.append(
            CampaignAnalyticsRow(
                id=c.id,
                campaign_name=c.campaign_name,
                file_used=c.file_used,
                total_sent=c.total_sent,
                total_failed=c.total_failed,
                total_skipped=c.total_skipped,
                date_sent=c.date_sent,
                delivery_rate=delivery_rate,
            )
        )
    return out


@app.get("/analytics/sendgrid", response_model=SendGridStatsResponse)
def analytics_sendgrid_stats():
    return _fetch_sendgrid_last_30_days()


@app.get("/analytics/sendgrid/series", response_model=SendGridSeriesResponse)
def analytics_sendgrid_series(
    granularity: Literal["day", "week", "month"] = Query("day"),
):
    return _fetch_sendgrid_series(granularity)


def _suppression_bounces_response(db: Session) -> SuppressionListResponse:
    raw, err = _sendgrid_suppression_fetch("bounce")
    if err:
        return SuppressionListResponse(items=[], error=err)
    follow = _follow_up_emails_for_kind(db, "bounce")
    items: list[SuppressionEntry] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        em = str(item.get("email") or "").strip().lower()
        if not em:
            continue
        reason = str(item.get("reason") or item.get("bounce_reason") or "").strip()
        items.append(
            SuppressionEntry(
                email=em,
                reason=reason or "—",
                date=_format_sendgrid_suppression_date(item.get("created")) or "—",
                marked_follow_up=em in follow,
            )
        )
    return SuppressionListResponse(items=items, error=None)


def _suppression_unsubscribes_response(db: Session) -> SuppressionListResponse:
    raw, err = _sendgrid_suppression_fetch("unsubscribe")
    if err:
        return SuppressionListResponse(items=[], error=err)
    follow = _follow_up_emails_for_kind(db, "unsubscribe")
    items: list[SuppressionEntry] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        em = str(item.get("email") or "").strip().lower()
        if not em:
            continue
        reason = str(item.get("reason") or "").strip() or "Unsubscribed"
        items.append(
            SuppressionEntry(
                email=em,
                reason=reason,
                date=_format_sendgrid_suppression_date(item.get("created")) or "—",
                marked_follow_up=em in follow,
            )
        )
    return SuppressionListResponse(items=items, error=None)


@app.get("/analytics/suppression/bounces", response_model=SuppressionListResponse)
def analytics_suppression_bounces_list(db: Session = Depends(get_db)):
    return _suppression_bounces_response(db)


@app.get("/analytics/suppression/unsubscribes", response_model=SuppressionListResponse)
def analytics_suppression_unsubscribes_list(db: Session = Depends(get_db)):
    return _suppression_unsubscribes_response(db)


@app.delete("/analytics/suppression/bounce")
def analytics_suppression_delete_bounce(
    email: str = Query(..., min_length=3), db: Session = Depends(get_db)
):
    em = email.strip().lower()
    if not _valid_email(em):
        raise HTTPException(status_code=400, detail="Invalid email")
    _sendgrid_suppression_delete("bounce", em)
    db.add(
        MarketingSuppressionFlag(
            email=em,
            kind="bounce",
            action="deleted",
            reason=None,
        )
    )
    db.commit()
    return {"ok": True, "email": em}


@app.delete("/analytics/suppression/unsubscribe")
def analytics_suppression_delete_unsubscribe(
    email: str = Query(..., min_length=3), db: Session = Depends(get_db)
):
    em = email.strip().lower()
    if not _valid_email(em):
        raise HTTPException(status_code=400, detail="Invalid email")
    _sendgrid_suppression_delete("unsubscribe", em)
    db.add(
        MarketingSuppressionFlag(
            email=em,
            kind="unsubscribe",
            action="deleted",
            reason=None,
        )
    )
    db.commit()
    return {"ok": True, "email": em}


@app.post("/analytics/suppression/follow-up")
def analytics_suppression_follow_up(
    body: SuppressionActionBody, db: Session = Depends(get_db)
):
    email = body.email.strip().lower()
    if not _valid_email(email):
        raise HTTPException(status_code=400, detail="Invalid email")
    db.add(
        MarketingSuppressionFlag(
            email=email,
            kind=body.kind,
            action="follow_up",
            reason=None,
        )
    )
    db.commit()
    return {"ok": True, "email": email}


@app.post("/contacts/import-tabular/preview", response_model=TabularImportPreviewResponse)
async def import_tabular_preview(file: UploadFile = File(...)):
    raw = await file.read()
    df = _tabular_dataframe_from_bytes(raw, file.filename or "")
    rows, total_rows, _skipped = _tabular_rows_from_df(df)
    preview = rows[:100]
    return TabularImportPreviewResponse(
        preview=preview,
        total_rows=total_rows,
        total_valid=len(rows),
    )


@app.post("/contacts/import-tabular/confirm", response_model=TabularImportConfirmSummary)
async def import_tabular_confirm(
    file: UploadFile = File(...),
    also_create_clients: str = Form("false"),
    db: Session = Depends(get_db),
):
    also = str(also_create_clients).lower() in ("1", "true", "yes", "on")
    raw = await file.read()
    df = _tabular_dataframe_from_bytes(raw, file.filename or "")
    rows, total_rows, skipped_invalid = _tabular_rows_from_df(df)

    contacts_added = 0
    contacts_updated = 0
    clients_created = 0
    clients_updated = 0

    for row in rows:
        email = row.email
        existing = db.query(Contact).filter(Contact.email == email).first()
        if existing:
            if row.name and str(row.name).strip():
                existing.name = str(row.name).strip()
            if row.phone and str(row.phone).strip():
                existing.phone = str(row.phone).strip()
            if row.business and str(row.business).strip():
                existing.company = str(row.business).strip()
            contacts_updated += 1
        else:
            db.add(
                Contact(
                    email=email,
                    name=(row.name or "").strip() or None,
                    phone=(row.phone or "").strip() or None,
                    company=(row.business or "").strip() or None,
                    state="OK",
                )
            )
            contacts_added += 1

        if also:
            biz = (row.business or "").strip() or None
            nm = (row.name or "").strip() or None
            client_name = (biz or nm or email.split("@")[0]).strip()[:255] or "Client"
            existing_client = (
                db.query(Client)
                .filter(Client.primary_contact_email == email)
                .first()
            )
            if existing_client:
                existing_client.primary_contact_name = (
                    nm or existing_client.primary_contact_name
                )
                if row.phone and str(row.phone).strip():
                    existing_client.primary_contact_phone = str(row.phone).strip()
                if biz:
                    existing_client.name = client_name
                clients_updated += 1
            else:
                db.add(
                    Client(
                        name=client_name,
                        primary_contact_email=email,
                        primary_contact_name=nm,
                        primary_contact_phone=(
                            str(row.phone).strip() if row.phone else None
                        ),
                        state="OK",
                    )
                )
                clients_created += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {e}") from e

    return TabularImportConfirmSummary(
        contacts_added=contacts_added,
        contacts_updated=contacts_updated,
        clients_created=clients_created,
        clients_updated=clients_updated,
        skipped_invalid=skipped_invalid,
        total_rows_processed=total_rows,
    )
