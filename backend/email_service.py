import os
from pathlib import Path
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

# Load .env from project root
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "rooteddominion405@gmail.com")
BUSINESS_NAME = os.getenv("BUSINESS_NAME", "Rooted Dominion")
BUSINESS_ADDRESS = os.getenv("BUSINESS_ADDRESS", "3609 Green Oaks Way, Edmond, OK 73034")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")


def build_email_footer(email: str) -> str:
    unsubscribe_url = f"{BACKEND_URL}/unsubscribe?email={email}"
    return f"""
    <br><br>
    <hr style="border: none; border-top: 1px solid #eee;">
    <p style="font-size: 12px; color: #999; text-align: center;">
        {BUSINESS_NAME}<br>
        {BUSINESS_ADDRESS}<br><br>
        You are receiving this email because you are a licensed 
        cannabis operator in Oklahoma.<br><br>
        <a href="{unsubscribe_url}" style="color: #999;">
            Unsubscribe
        </a>
    </p>
    """


def send_email(to_email: str, subject: str, content: str, plain_text: str = "") -> bool:
    if not SENDGRID_API_KEY:
        print("❌ Missing SENDGRID_API_KEY")
        return False

    try:
        full_html = content + build_email_footer(to_email)

        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=full_html,
            plain_text_content=plain_text if plain_text else None
        )

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)

        print(f"✅ Email sent to {to_email}: {response.status_code}")
        return True

    except Exception as e:
        print(f"❌ Email error for {to_email}: {e}")
        return False