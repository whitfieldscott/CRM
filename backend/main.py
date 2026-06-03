import io
import json
import os
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import quote

import pandas as pd
import requests
from pydantic import BaseModel, ConfigDict
from csv_sender import send_bulk_emails
from data_paths import resolve_data_csv_path, safe_data_csv_file_name
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
    SmsSeriesPoint,
    SmsSeriesResponse,
    SmsSummaryAnalyticsResponse,
)
from schemas import (
    CSVImportSummary,
    TabularImportConfirmSummary,
    TabularImportPreviewResponse,
    TabularImportRow,
    CampaignLogCreate,
    CampaignLogResponse,
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
from routers.metrc_router import router as metrc_router
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

app = FastAPI(title="Rooted Dominion CRM API")

# Local dev origins. Production: CORS_ALLOW_ORIGINS=https://app.arkonesystems.com
_cors_env = (os.getenv("CORS_ALLOW_ORIGINS") or "").strip()
if _cors_env:
    _cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
else:
    _cors_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metrc_router)


class CampaignDetailEmailSend(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recipient_email: str
    success: bool
    sent_at: Optional[datetime] = None
    subject: Optional[str] = None


class CampaignDetailStats(BaseModel):
    total_sent: int
    total_failed: int
    total_skipped: int
    success_rate: float


class CampaignDeliveryIssue(BaseModel):
    email: str
    reason: str
    occurred_at: Optional[datetime] = None


class CampaignDetailsResponse(BaseModel):
    campaign: CampaignLogResponse
    email_sends: list[CampaignDetailEmailSend]
    stats: CampaignDetailStats
    failed_emails: list[CampaignDetailEmailSend]
    delivery_issues: list[CampaignDeliveryIssue]


class TemplateListItemResponse(BaseModel):
    id: str
    name: str
    created_at: str
    updated_at: str


class TemplateFullResponse(BaseModel):
    id: str
    name: str
    html: str


class TemplateCreateBody(BaseModel):
    name: str
    html: str


class TemplateUpdateBody(BaseModel):
    name: str
    html: str


class TemplateCreateResponse(BaseModel):
    id: str
    name: str
    success: bool


class CampaignSendRequest(BaseModel):
    campaign_name: str
    file_name: str
    test_email: Optional[str] = None
    html_content: Optional[str] = None


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
EMAIL_TEMPLATE_SIMPLE_PATH = DATA_DIR / "email_template_simple.html"
TEMPLATES_DIR = DATA_DIR / "templates"
TEMPLATES_INDEX_PATH = TEMPLATES_DIR / "index.json"

# Used only if data/email_template.html is missing (e.g. first deploy before file is created).
_FALLBACK_TEMPLATE_HTML = """<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:24px;font-family:system-ui,sans-serif;">
<p>Rooted Dominion — template file was not found. Save a draft from the Campaigns page
or add <code>data/email_template.html</code>.</p>
<p><a href="{{UNSUBSCRIBE_URL}}">Unsubscribe</a></p>
</body></html>"""

_FALLBACK_SIMPLE_TEMPLATE_HTML = """<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#f6f7f6; font-family:Arial, sans-serif; color:#222;">
    <div style="max-width:640px; margin:0 auto; background:#ffffff; padding:28px; border:1px solid #ddd;">
      <h2 style="margin-top:0; color:#1f3d2b;">
        Licensed Clone Availability — Rooted Dominion | Edmond, OK
      </h2>
      <p>Hello,</p>
      <p>
        Rooted Dominion (Exotic Gardens at Fire Ranch) is a licensed Oklahoma grow operation
        connecting with other licensed operators regarding available genetics inventory.
      </p>
      <p>
        We provide premium, Metrc-compliant rooted clones and are currently building
        business relationships with licensed operators in the Oklahoma market.
      </p>
      <p>
        If you would like to receive our current availability list or discuss potential
        collaboration, feel free to reply to this email or contact us directly.
      </p>
      <p>
        <strong>Scott Whitfield</strong><br />
        Rooted Dominion<br />
        Edmond, OK 73034<br />
        <a href="mailto:admin@arkonesystems.com">admin@arkonesystems.com</a><br />
        (925) 457-6236
      </p>
      <hr style="border:none; border-top:1px solid #ddd; margin:28px 0;" />
      <p style="font-size:12px; color:#666; line-height:1.5;">
        You are receiving this email as part of business-to-business communication
        between licensed operators. If you prefer not to receive future
        communications, you may
        <a href="{{unsubscribe_url}}" style="color:#1f6feb;">unsubscribe here</a>.
      </p>
      <p style="font-size:12px; color:#666; line-height:1.5;">
        ArkOne Systems LLC<br />
        113 NW 13th St, Apt 205<br />
        Oklahoma City, OK 73103
      </p>
    </div>
  </body>
</html>"""


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


def read_simple_email_template_string() -> str:
    if EMAIL_TEMPLATE_SIMPLE_PATH.is_file():
        try:
            return EMAIL_TEMPLATE_SIMPLE_PATH.read_text(encoding="utf-8")
        except OSError as e:
            raise HTTPException(
                status_code=500, detail=f"Could not read simple email template: {e}"
            )
    return _FALLBACK_SIMPLE_TEMPLATE_HTML


def write_simple_email_template_file(html: str) -> None:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        EMAIL_TEMPLATE_SIMPLE_PATH.write_text(html, encoding="utf-8")
    except OSError as e:
        raise HTTPException(
            status_code=500, detail=f"Could not save simple email template: {e}"
        )


def _templates_today_iso() -> str:
    return datetime.utcnow().date().isoformat()


def _ensure_templates_dir() -> None:
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)


def _slug_template_name_for_filename(name: str) -> str:
    s = re.sub(r"[^\w\-\s]", "", (name or "").strip(), flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "_", s).strip("_")
    return s or "template"


def _build_managed_template_filename(template_id: str, name: str) -> str:
    return f"{template_id}_{_slug_template_name_for_filename(name)}.html"


def _read_templates_index() -> dict:
    _ensure_templates_dir()
    if not TEMPLATES_INDEX_PATH.is_file():
        return {"templates": []}
    try:
        raw = TEMPLATES_INDEX_PATH.read_text(encoding="utf-8")
        data = json.loads(raw)
    except (OSError, json.JSONDecodeError):
        return {"templates": []}
    if not isinstance(data, dict) or not isinstance(data.get("templates"), list):
        return {"templates": []}
    return data


def _write_templates_index(data: dict) -> None:
    _ensure_templates_dir()
    TEMPLATES_INDEX_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _sorted_template_entries(templates: list) -> list:
    def sort_key(t: dict) -> tuple:
        tid = str(t.get("id", ""))
        try:
            return (0, int(tid), tid)
        except ValueError:
            return (1, 0, tid)

    return sorted(templates, key=sort_key)


def _next_managed_template_id(templates: list) -> str:
    best = 0
    for t in templates:
        tid = str(t.get("id", ""))
        if tid.isdigit():
            best = max(best, int(tid))
    return str(best + 1)


def ensure_templates_seeded() -> None:
    """Create data/templates from legacy HTML files when index is missing or empty."""
    _ensure_templates_dir()
    data = _read_templates_index()
    if data.get("templates"):
        return
    today = _templates_today_iso()
    full_html = read_email_template_string()
    simple_html = read_simple_email_template_string()
    entries = [
        {
            "id": "1",
            "name": "Clone Availability - Full Inventory",
            "file": _build_managed_template_filename(
                "1", "Clone Availability - Full Inventory"
            ),
            "created_at": today,
            "updated_at": today,
        },
        {
            "id": "2",
            "name": "Simple B2B Introduction",
            "file": _build_managed_template_filename("2", "Simple B2B Introduction"),
            "created_at": today,
            "updated_at": today,
        },
    ]
    for entry, html in zip(entries, [full_html, simple_html]):
        path = TEMPLATES_DIR / entry["file"]
        path.write_text(html, encoding="utf-8")
    _write_templates_index({"templates": entries})


def _find_managed_template_entry(data: dict, template_id: str) -> Optional[dict]:
    for t in data.get("templates", []):
        if str(t.get("id")) == str(template_id):
            return t
    return None


def _safe_data_csv_file_name(name: str) -> str:
    return safe_data_csv_file_name(name)


def _data_csv_path(file_name: str) -> str:
    return str(resolve_data_csv_path(file_name))


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
    ensure_templates_seeded()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}


@app.get("/data/csv-files")
def list_data_csv_files():
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        files = sorted(
            p.name
            for p in DATA_DIR.iterdir()
            if p.is_file() and p.suffix.lower() == ".csv"
        )
        return {"files": files}
    except OSError as e:
        raise HTTPException(status_code=500, detail=str(e))


# @app.get("/metrc/licenses")
# def metrc_list_licenses():
#     try:
#         return list_licenses()
#     except MetrcError as e:
#         raise HTTPException(status_code=e.status_code, detail=e.detail) from e


# @app.get("/metrc/packages")
# def metrc_packages(
#     facility_license: str = Query(
#         ...,
#         alias="license",
#         min_length=1,
#         description="Facility license number",
#     ),
# ):
#     try:
#         return active_packages(facility_license)
#     except MetrcError as e:
#         raise HTTPException(status_code=e.status_code, detail=e.detail) from e


# @app.get("/metrc/transfers")
# def metrc_transfers(
#     facility_license: str = Query(
#         ...,
#         alias="license",
#         min_length=1,
#         description="Facility license number",
#     ),
# ):
#     try:
#         return transfers_incoming_outgoing(facility_license)
#     except MetrcError as e:
#         raise HTTPException(status_code=e.status_code, detail=e.detail) from e


# @app.get("/metrc/plants")
# def metrc_plants(
#     facility_license: str = Query(
#         ...,
#         alias="license",
#         min_length=1,
#         description="Facility license number",
#     ),
# ):
#     try:
#         return plants_for_license(facility_license)
#     except MetrcError as e:
#         raise HTTPException(status_code=e.status_code, detail=e.detail) from e


# Phase 1 TODO: Depends(require_admin_api_key) on get_settings, update_settings
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


# Phase 1 TODO: Depends(require_admin_api_key)
@app.post("/send-bulk")
def send_bulk(
    file_name: str,
    campaign_name: Optional[str] = None,
    test_email: Optional[str] = None,
    db: Session = Depends(get_db),
):
    safe_name = _safe_data_csv_file_name(file_name)
    file_path = _data_csv_path(safe_name)

    df = load_and_clean_csv(file_path)

    name = campaign_name or f"Bulk: {safe_name}"
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
        result = send_bulk_emails(
            df,
            file_name=safe_name,
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
    file_path = _data_csv_path(file_name)
    df = load_and_clean_csv(file_path)
    preview_data = df.head(5).to_dict(orient="records")
    return {
        "total_rows": len(df),
        "columns": list(df.columns),
        "preview": preview_data,
    }


@app.get("/confirm-send")
def confirm_send(file_name: str):
    safe_name = _safe_data_csv_file_name(file_name)
    file_path = _data_csv_path(safe_name)
    df = load_and_clean_csv(file_path)
    return {
        "file_name": safe_name,
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
    path = _data_csv_path(safe)
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
    path = _data_csv_path(safe)
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

    # Phase 1 TODO: Depends(require_admin_api_key)
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


@app.get("/campaigns/template/simple")
def get_campaign_simple_email_template():
    """Return saved HTML from data/email_template_simple.html, or fallback if missing."""
    return {"html": read_simple_email_template_string()}


@app.post("/campaigns/template/simple")
def save_campaign_simple_email_template(payload: CampaignTemplateBody):
    write_simple_email_template_file(payload.html)
    return {"success": True}


@app.get("/campaigns/templates", response_model=list[TemplateListItemResponse])
def list_managed_email_templates():
    ensure_templates_seeded()
    data = _read_templates_index()
    return [
        TemplateListItemResponse(
            id=str(t["id"]),
            name=str(t["name"]),
            created_at=str(t["created_at"]),
            updated_at=str(t["updated_at"]),
        )
        for t in _sorted_template_entries(list(data.get("templates", [])))
    ]


@app.get("/campaigns/templates/{template_id}", response_model=TemplateFullResponse)
def get_managed_email_template(template_id: str):
    ensure_templates_seeded()
    data = _read_templates_index()
    entry = _find_managed_template_entry(data, template_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Template not found")
    path = TEMPLATES_DIR / str(entry["file"])
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Template file missing")
    try:
        html = path.read_text(encoding="utf-8")
    except OSError as e:
        raise HTTPException(
            status_code=500, detail=f"Could not read template file: {e}"
        )
    return TemplateFullResponse(
        id=str(entry["id"]),
        name=str(entry["name"]),
        html=html,
    )


@app.post("/campaigns/templates", response_model=TemplateCreateResponse)
def create_managed_email_template(payload: TemplateCreateBody):
    ensure_templates_seeded()
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    data = _read_templates_index()
    templates = list(data.get("templates", []))
    new_id = _next_managed_template_id(templates)
    fn = _build_managed_template_filename(new_id, name)
    today = _templates_today_iso()
    entry = {
        "id": new_id,
        "name": name,
        "file": fn,
        "created_at": today,
        "updated_at": today,
    }
    path = TEMPLATES_DIR / fn
    try:
        path.write_text(payload.html, encoding="utf-8")
    except OSError as e:
        raise HTTPException(
            status_code=500, detail=f"Could not save template file: {e}"
        )
    templates.append(entry)
    data["templates"] = templates
    _write_templates_index(data)
    return TemplateCreateResponse(id=new_id, name=name, success=True)


@app.put("/campaigns/templates/{template_id}")
def update_managed_email_template(template_id: str, payload: TemplateUpdateBody):
    ensure_templates_seeded()
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    data = _read_templates_index()
    entry = _find_managed_template_entry(data, template_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Template not found")
    old_path = TEMPLATES_DIR / str(entry["file"])
    new_fn = _build_managed_template_filename(template_id, name)
    new_path = TEMPLATES_DIR / new_fn
    try:
        if old_path.resolve() != new_path.resolve() and old_path.is_file():
            old_path.unlink()
        new_path.write_text(payload.html, encoding="utf-8")
    except OSError as e:
        raise HTTPException(
            status_code=500, detail=f"Could not update template file: {e}"
        )
    entry["name"] = name
    entry["file"] = new_fn
    entry["updated_at"] = _templates_today_iso()
    _write_templates_index(data)
    return {"success": True}


@app.delete("/campaigns/templates/{template_id}")
def delete_managed_email_template(template_id: str):
    ensure_templates_seeded()
    data = _read_templates_index()
    templates = list(data.get("templates", []))
    entry = _find_managed_template_entry(data, template_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Template not found")
    path = TEMPLATES_DIR / str(entry["file"])
    if path.is_file():
        try:
            path.unlink()
        except OSError as e:
            raise HTTPException(
                status_code=500, detail=f"Could not delete template file: {e}"
            )
    data["templates"] = [t for t in templates if str(t.get("id")) != str(template_id)]
    _write_templates_index(data)
    return {"success": True}


# Phase 1 TODO: Depends(require_admin_api_key)
@app.post("/campaigns/send")
def send_campaign_with_template(
    payload: CampaignSendRequest, db: Session = Depends(get_db)
):
    """
    Send bulk HTML email. Uses request html_content when provided (editor body);
    otherwise falls back to data/email_template.html.
    """
    hc = (payload.html_content or "").strip()
    template_html = payload.html_content if hc else read_email_template_string()
    safe_name = _safe_data_csv_file_name(payload.file_name)
    file_path = _data_csv_path(safe_name)
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


@app.get("/campaigns/{campaign_id}/details", response_model=CampaignDetailsResponse)
def get_campaign_details(campaign_id: int, db: Session = Depends(get_db)):
    log = db.query(CampaignLog).filter(CampaignLog.id == campaign_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Campaign log not found")

    sends = (
        db.query(EmailSendRecord)
        .filter(EmailSendRecord.campaign_log_id == campaign_id)
        .order_by(EmailSendRecord.sent_at.asc(), EmailSendRecord.id.asc())
        .all()
    )
    email_sends = [CampaignDetailEmailSend.model_validate(r) for r in sends]
    failed_emails = [CampaignDetailEmailSend.model_validate(r) for r in sends if not r.success]
    n = len(sends)
    successes = sum(1 for r in sends if r.success)
    success_rate = round(100.0 * successes / n, 1) if n else 0.0
    stats = CampaignDetailStats(
        total_sent=log.total_sent,
        total_failed=log.total_failed,
        total_skipped=log.total_skipped,
        success_rate=success_rate,
    )
    delivery_issues = _build_campaign_delivery_issues(log, sends)
    return CampaignDetailsResponse(
        campaign=CampaignLogResponse.model_validate(log),
        email_sends=email_sends,
        stats=stats,
        failed_emails=failed_emails,
        delivery_issues=delivery_issues,
    )


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


# Phase 1 TODO: Depends(require_admin_api_key)
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


def _fetch_sendgrid_stats_for_campaign_day(day: date) -> SendGridStatsResponse:
    """Aggregate SendGrid v3/stats for a single calendar day (UTC date)."""
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

    url = (
        "https://api.sendgrid.com/v3/stats"
        f"?start_date={day.isoformat()}&end_date={day.isoformat()}&aggregated_by=day"
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
        for bucket in payload:
            for block in bucket.get("stats") or []:
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


def _suppression_item_created_date(val) -> Optional[date]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, (int, float)):
        try:
            return datetime.utcfromtimestamp(int(val)).date()
        except (ValueError, OSError):
            return None
    s = str(val).strip()
    if s.isdigit():
        try:
            return datetime.utcfromtimestamp(int(s)).date()
        except (ValueError, OSError):
            return None
    try:
        if len(s) >= 10:
            return date.fromisoformat(s[:10])
    except ValueError:
        pass
    return None


def _build_campaign_delivery_issues(
    log: CampaignLog, sends: list[EmailSendRecord]
) -> list[CampaignDeliveryIssue]:
    recipients = {s.recipient_email.strip().lower() for s in sends}
    issues: list[CampaignDeliveryIssue] = []
    failed_lower: set[str] = set()

    for s in sends:
        if not s.success:
            em = s.recipient_email.strip().lower()
            failed_lower.add(em)
            issues.append(
                CampaignDeliveryIssue(
                    email=s.recipient_email,
                    reason="Failed to send",
                    occurred_at=s.sent_at,
                )
            )

    camp_day: Optional[date] = None
    if log.date_sent:
        ds = log.date_sent
        camp_day = ds.date() if isinstance(ds, datetime) else ds

    if camp_day and recipients:
        raw, err = _sendgrid_suppression_fetch("bounce")
        if not err:
            for item in raw:
                if not isinstance(item, dict):
                    continue
                raw_email = str(item.get("email") or "").strip()
                em = raw_email.lower()
                if not em or em not in recipients:
                    continue
                bd = _suppression_item_created_date(item.get("created"))
                if bd is None or bd != camp_day:
                    continue
                if em in failed_lower:
                    continue
                issues.append(
                    CampaignDeliveryIssue(
                        email=raw_email,
                        reason="Bounced",
                        occurred_at=None,
                    )
                )

    return issues


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


def _sms_campaign_series(db: Session, granularity: str) -> SmsSeriesResponse:
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

    start_ts = datetime.combine(start_d, datetime.min.time())
    end_ts = datetime.combine(end_d, datetime.max.time())

    rows = (
        db.query(SmsCampaignLog)
        .filter(
            SmsCampaignLog.date_sent.isnot(None),
            SmsCampaignLog.date_sent >= start_ts,
            SmsCampaignLog.date_sent <= end_ts,
        )
        .all()
    )

    sums: dict[str, dict[str, int]] = defaultdict(
        lambda: {"sent": 0, "failed": 0, "skipped": 0}
    )

    def bucket_key(bd: date) -> str:
        if agg == "day":
            return bd.isoformat()
        if agg == "week":
            monday = bd - timedelta(days=bd.weekday())
            return monday.isoformat()
        return bd.strftime("%Y-%m")

    for r in rows:
        if not r.date_sent:
            continue
        bd = (
            r.date_sent.date()
            if isinstance(r.date_sent, datetime)
            else r.date_sent
        )
        k = bucket_key(bd)
        sums[k]["sent"] += int(r.total_sent or 0)
        sums[k]["failed"] += int(r.total_failed or 0)
        sums[k]["skipped"] += int(r.total_skipped or 0)

    period_keys: list[str] = []
    if agg == "day":
        cur = start_d
        while cur <= end_d:
            period_keys.append(cur.isoformat())
            cur += timedelta(days=1)
    elif agg == "week":
        cur = start_d - timedelta(days=start_d.weekday())
        while cur <= end_d:
            period_keys.append(cur.isoformat())
            cur += timedelta(days=7)
    else:
        y, m = start_d.year, start_d.month
        while (y, m) <= (end_d.year, end_d.month):
            period_keys.append(f"{y:04d}-{m:02d}")
            m += 1
            if m > 12:
                m = 1
                y += 1

    points = [
        SmsSeriesPoint(
            period=k,
            sent=sums[k]["sent"],
            failed=sums[k]["failed"],
            skipped=sums[k]["skipped"],
        )
        for k in period_keys
    ]
    return SmsSeriesResponse(granularity=granularity, points=points, error=None)


@app.get("/analytics/sms/series", response_model=SmsSeriesResponse)
def analytics_sms_series(
    granularity: Literal["day", "week", "month"] = Query("day"),
    db: Session = Depends(get_db),
):
    return _sms_campaign_series(db, granularity)


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


@app.get(
    "/analytics/sendgrid/campaign/{campaign_id}",
    response_model=SendGridStatsResponse,
)
def analytics_sendgrid_campaign_day(
    campaign_id: int, db: Session = Depends(get_db)
):
    log = db.query(CampaignLog).filter(CampaignLog.id == campaign_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Campaign log not found")
    if not log.date_sent:
        return SendGridStatsResponse(
            opens=0,
            clicks=0,
            bounces=0,
            spam_reports=0,
            unsubscribes=0,
            delivered=0,
            requests=0,
            error="Campaign has no date_sent",
        )
    ds = log.date_sent
    day = ds.date() if isinstance(ds, datetime) else ds
    return _fetch_sendgrid_stats_for_campaign_day(day)


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
