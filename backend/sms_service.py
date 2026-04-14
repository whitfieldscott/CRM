import os
import re
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from twilio.base.exceptions import TwilioException
from twilio.rest import Client

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")  # E.164 from number
TEST_SMS_TO = os.getenv("TEST_SMS_TO", "")  # Test mode: all SMS go here (E.164)


def twilio_configured() -> bool:
    return bool(
        TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER
    )


def normalize_us_e164(raw: object) -> Optional[str]:
    """Normalize US phone numbers to E.164 (+1XXXXXXXXXX). Returns None if invalid."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s or s.lower() == "nan":
        return None
    digits = re.sub(r"\D", "", s)
    if len(digits) == 10:
        return "+1" + digits
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits
    return None


def _client() -> Client:
    if not twilio_configured():
        raise RuntimeError("Twilio is not configured")
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def send_sms(to_e164: str, body: str) -> bool:
    """
    Send a single SMS via Twilio. Caller passes normalized E.164 `to_e164`.
    Returns True on accepted send, False on failure.
    """
    if not twilio_configured():
        print("⚠️ Twilio not configured; SMS not sent.")
        return False
    if not body or not str(body).strip():
        return False
    try:
        client = _client()
        client.messages.create(
            body=body.strip(),
            from_=TWILIO_PHONE_NUMBER,
            to=to_e164,
        )
        return True
    except TwilioException as e:
        print(f"❌ Twilio error sending to {to_e164}: {e}")
        return False
    except Exception as e:
        print(f"❌ SMS send error: {e}")
        return False
