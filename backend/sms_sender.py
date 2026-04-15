import json
import os
import time
from datetime import datetime
from typing import Optional

from csv_sender import (
    BATCH_SIZE,
    DELAY_BETWEEN_BATCHES,
    WARMUP_SCHEDULE,
    WARMUP_START_DATE,
)
from sms_service import TEST_SMS_TO, normalize_us_e164, send_sms

DELAY_BETWEEN_SMS = 1.0

SMS_TRACKING_FILE = "../data/sms_send_tracking.json"


def get_sms_daily_limit() -> int:
    """Same warmup schedule as email (SMS uses same daily cap model)."""
    today = datetime.now()
    days_since_start = (today - WARMUP_START_DATE).days + 1
    if days_since_start < 1:
        days_since_start = 1
    if days_since_start > 21:
        return 999999
    limit = WARMUP_SCHEDULE.get(days_since_start, 200)
    print(f"📅 SMS day {days_since_start} — daily limit: {limit}")
    return limit


def _load_tracking() -> dict:
    if os.path.exists(SMS_TRACKING_FILE):
        with open(SMS_TRACKING_FILE, "r") as f:
            return json.load(f)
    return {}


def _save_tracking(tracking: dict) -> None:
    with open(SMS_TRACKING_FILE, "w") as f:
        json.dump(tracking, f, indent=2)


def _start_position(file_name: str) -> int:
    return _load_tracking().get(file_name, {}).get("last_position", 0)


def _update_position(file_name: str, position: int, total_sent_so_far: int) -> None:
    tracking = _load_tracking()
    if file_name not in tracking:
        tracking[file_name] = {}
    tracking[file_name]["last_position"] = position
    tracking[file_name]["total_sent_so_far"] = total_sent_so_far
    tracking[file_name]["last_send_date"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    _save_tracking(tracking)


def _contact_for_phone(db, e164: str):
    from models import Contact

    c = (
        db.query(Contact).filter(Contact.phone.isnot(None)).all()
    )
    for row in c:
        if normalize_us_e164(row.phone) == e164:
            return row
    return None


def send_bulk_sms(
    df,
    file_name: str,
    message: str,
    *,
    db=None,
    sms_campaign_log_id: Optional[int] = None,
    sms_test_mode: bool = False,
) -> dict:
    """
    DataFrame must have a normalized E.164 `phone` column.
    Respects warmup daily limit and position tracking (separate file from email).

    When ``sms_test_mode`` is True, every message in the batch is sent only to
    ``TEST_SMS_TO`` (caller must ensure it is set); CSV phones are still used
    for logging / contact matching.
    """
    if "phone" not in df.columns:
        raise ValueError("DataFrame must contain a 'phone' column")

    daily_limit = get_sms_daily_limit()
    test_dest = (TEST_SMS_TO or "").strip() if sms_test_mode else ""

    print(f"📊 Total rows with valid phones in file: {len(df)}")

    start_pos = _start_position(file_name)
    print(f"📍 SMS starting from position: {start_pos}")

    if start_pos >= len(df):
        print("🔄 SMS list fully sent once; resetting position.")
        start_pos = 0
        tracking = _load_tracking()
        if file_name in tracking:
            tracking[file_name]["last_position"] = 0
        _save_tracking(tracking)

    batch = df.iloc[start_pos : start_pos + daily_limit]
    print(
        f"📤 SMS batch contacts {start_pos + 1} — {start_pos + len(batch)} (limit {daily_limit})"
    )

    total_sent = 0
    total_failed = 0
    total_skipped = 0
    log_db = db is not None and sms_campaign_log_id is not None

    if sms_test_mode and not test_dest:
        print("⚠️ SMS test mode but TEST_SMS_TO is empty — caller should validate.")

    try:
        for i, (_, row) in enumerate(batch.iterrows()):
            dest_phone = row["phone"]
            if not dest_phone or str(dest_phone).strip() == "":
                total_skipped += 1
                continue

            to_send = test_dest if sms_test_mode and test_dest else str(dest_phone)
            if sms_test_mode and not test_dest:
                total_skipped += 1
                continue

            print(
                f"💬 [{i+1}/{len(batch)}] SMS → {dest_phone}"
                + (f" (test destination: {to_send})" if sms_test_mode else "")
            )

            ok = send_sms(to_send, message)

            if ok:
                total_sent += 1
            else:
                total_failed += 1

            if log_db and ok:
                contact = _contact_for_phone(db, str(dest_phone))
                if contact:
                    contact.last_contacted = datetime.utcnow()

            time.sleep(DELAY_BETWEEN_SMS)

            if (i + 1) % BATCH_SIZE == 0:
                print(
                    f"⏸️ SMS batch of {BATCH_SIZE} done. Pausing {DELAY_BETWEEN_BATCHES}s..."
                )
                time.sleep(DELAY_BETWEEN_BATCHES)

        if log_db:
            db.commit()
    except Exception:
        if log_db:
            db.rollback()
        raise

    new_position = start_pos + len(batch)
    tracking = _load_tracking()
    total_sent_so_far = (
        tracking.get(file_name, {}).get("total_sent_so_far", 0) + total_sent
    )
    _update_position(file_name, new_position, total_sent_so_far)

    print(
        f"\n✅ SMS done — Sent: {total_sent} | Failed: {total_failed} | Skipped: {total_skipped}"
    )

    return {
        "sent": total_sent,
        "failed": total_failed,
        "skipped": total_skipped,
        "daily_limit": daily_limit,
        "next_position": new_position,
        "total_sent_so_far": total_sent_so_far,
        "sms_test_mode": sms_test_mode,
    }
