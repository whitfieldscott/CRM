import json
import os
import time
from typing import Optional

import requests
from datetime import datetime

from email_service import send_email
from settings_store import get_test_mode

TEST_EMAIL = os.getenv("TEST_EMAIL", "admin@arkonesystems.com")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

# Throttle settings
BATCH_SIZE = 50
DELAY_BETWEEN_EMAILS = 1.5
DELAY_BETWEEN_BATCHES = 60

# Warmup schedule
WARMUP_SCHEDULE = {
    1: 200,
    2: 200,
    3: 200,
    4: 200,
    5: 200,
    6: 200,
    7: 200,
    8: 400,
    9: 400,
    10: 400,
    11: 400,
    12: 400,
    13: 400,
    14: 400,
    15: 800,
    16: 800,
    17: 800,
    18: 800,
    19: 800,
    20: 800,
    21: 800,
}

WARMUP_START_DATE = datetime(2026, 4, 13)
TRACKING_FILE = "../data/send_tracking.json"


def get_daily_limit() -> int:
    today = datetime.now()
    days_since_start = (today - WARMUP_START_DATE).days + 1

    if days_since_start < 1:
        days_since_start = 1

    if days_since_start > 21:
        print(f"📅 Day {days_since_start} — Warmup complete. Sending full list.")
        return 999999

    limit = WARMUP_SCHEDULE.get(days_since_start, 200)
    print(f"📅 Day {days_since_start} of warmup — Daily limit: {limit} emails")
    return limit


def load_tracking() -> dict:
    if os.path.exists(TRACKING_FILE):
        with open(TRACKING_FILE, "r") as f:
            return json.load(f)
    return {}


def save_tracking(tracking: dict):
    with open(TRACKING_FILE, "w") as f:
        json.dump(tracking, f, indent=2)


def get_start_position(file_name: str) -> int:
    tracking = load_tracking()
    return tracking.get(file_name, {}).get("last_position", 0)


def update_position(file_name: str, position: int, total_sent: int):
    tracking = load_tracking()
    if file_name not in tracking:
        tracking[file_name] = {}
    tracking[file_name]["last_position"] = position
    tracking[file_name]["total_sent_so_far"] = total_sent
    tracking[file_name]["last_send_date"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    save_tracking(tracking)


def get_unsubscribed_emails() -> set:
    try:
        res = requests.get(f"{BACKEND_URL}/unsubscribe-list")
        if res.status_code == 200:
            return set(res.json().get("emails", []))
    except Exception as e:
        print(f"⚠️ Could not fetch unsubscribe list: {e}")
    return set()


def send_bulk_emails(
    df,
    file_name: str = "unknown",
    db=None,
    campaign_log_id: Optional[int] = None,
    email_subject: Optional[str] = None,
    html_content: Optional[str] = None,
    plain_text: Optional[str] = None,
    test_email_override: Optional[str] = None,
):
    """
    Expects a CLEAN dataframe with an 'email' column.
    Tracks position so each day sends the next batch.
    Optional db + campaign_log_id: logs EmailSendRecord rows and updates Contact.last_contacted.
    """
    from sqlalchemy import func

    from models import Client, Contact, EmailSendRecord

    subject = email_subject or (
        "Available Clones — Rooted Dominion | Rooted & Ready $5 Each"
    )
    use_custom_html = html_content is not None and str(html_content).strip() != ""
    content = (html_content or "").strip() if use_custom_html else ""
    default_plain = """
Hello Fellow Licensed Growers,

Rooted Dominion (Exotic Gardens at Fire Ranch) is your premium clone choice.
We have clones rooted and ready at $5 each — Metrc compliant.

Call to order: (925) 457-6236

Reply to this email or call for pricing on larger orders.
For delivery pricing, please call for a quick quote.

Scott Whitfield
Sales Representative · Rooted Dominion
(925) 457-6236
admin@arkonesystems.com
    """
    body_plain = (
        plain_text.strip()
        if plain_text and str(plain_text).strip()
        else (
            "Please view the HTML version of this message."
            if use_custom_html
            else default_plain
        )
    )

    test_mode = get_test_mode()
    override = (test_email_override or "").strip().lower()
    daily_limit = get_daily_limit()

    unsubscribed = get_unsubscribed_emails()
    print(f"🚫 Unsubscribed emails on file: {len(unsubscribed)}")

    df = df[~df["email"].isin(unsubscribed)].reset_index(drop=True)
    print(f"📊 Total unique contacts: {len(df)}")

    start_pos = get_start_position(file_name)
    print(f"📍 Starting from position: {start_pos}")

    if start_pos >= len(df):
        print("🔄 Full list has been sent. Resetting to start.")
        start_pos = 0
        tracking = load_tracking()
        if file_name in tracking:
            tracking[file_name]["last_position"] = 0
        save_tracking(tracking)

    batch = df.iloc[start_pos : start_pos + daily_limit]
    print(f"📤 Sending to contacts {start_pos + 1} — {start_pos + len(batch)} today...")

    total_sent = 0
    total_failed = 0
    total_skipped = 0

    log_db = db is not None and campaign_log_id is not None

    try:
        for i, (_, row) in enumerate(batch.iterrows()):
            real_email = row["email"]

            if not real_email or "@" not in str(real_email):
                total_skipped += 1
                continue

            real_email = str(real_email).strip().lower()
            if override and "@" in override:
                to_email = override
            elif test_mode:
                to_email = TEST_EMAIL
            else:
                to_email = real_email

            print(f"📨 [{i+1}/{len(batch)}] Sending to: {real_email} → {to_email}")

            success = send_email(
                to_email=to_email,
                subject=subject,
                content=content,
                plain_text=body_plain,
                force_html_body=use_custom_html,
            )

            if success:
                total_sent += 1
            else:
                total_failed += 1

            if log_db:
                contact = (
                    db.query(Contact).filter(Contact.email == real_email).first()
                )
                client = (
                    db.query(Client)
                    .filter(
                        func.lower(Client.primary_contact_email) == real_email
                    )
                    .first()
                )
                rec = EmailSendRecord(
                    client_id=client.id if client else None,
                    contact_id=contact.id if contact else None,
                    campaign_log_id=campaign_log_id,
                    recipient_email=real_email,
                    subject=subject,
                    success=success,
                    sent_at=datetime.utcnow(),
                )
                db.add(rec)
                if success and contact:
                    contact.last_contacted = datetime.utcnow()

            time.sleep(DELAY_BETWEEN_EMAILS)

            if (i + 1) % BATCH_SIZE == 0:
                print(
                    f"⏸️ Batch of {BATCH_SIZE} done. Pausing {DELAY_BETWEEN_BATCHES}s..."
                )
                time.sleep(DELAY_BETWEEN_BATCHES)

        if log_db:
            db.commit()
    except Exception:
        if log_db:
            db.rollback()
        raise

    new_position = start_pos + len(batch)
    tracking = load_tracking()
    total_sent_so_far = (
        tracking.get(file_name, {}).get("total_sent_so_far", 0) + total_sent
    )
    update_position(file_name, new_position, total_sent_so_far)

    print(
        f"\n✅ Done — Sent: {total_sent} | ❌ Failed: {total_failed} | ⏭️ Skipped: {total_skipped}"
    )
    print(f"📍 Next send will start at position: {new_position}")
    print(f"📊 Total sent so far: {total_sent_so_far}/{len(df)}")

    return {
        "sent": total_sent,
        "failed": total_failed,
        "skipped": total_skipped,
        "daily_limit": daily_limit,
        "next_position": new_position,
        "total_sent_so_far": total_sent_so_far,
    }
