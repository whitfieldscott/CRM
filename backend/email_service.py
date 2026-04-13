import os
from pathlib import Path
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, To

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "admin@arkonesystems.com")
TEMPLATE_ID = os.getenv("SENDGRID_TEMPLATE_ID")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")


def send_email(to_email: str, subject: str, content: str, plain_text: str = "") -> bool:
    if not SENDGRID_API_KEY:
        print("❌ Missing SENDGRID_API_KEY")
        return False

    try:
        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=to_email,
        )

        if TEMPLATE_ID:
            # Use SendGrid dynamic template
            message.template_id = TEMPLATE_ID
            message.dynamic_template_data = {
                "unsubscribe_url": f"{BACKEND_URL}/unsubscribe?email={to_email}"
            }
        else:
            # Fallback to raw HTML
            message.subject = subject
            message.html_content = content

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)

        print(f"✅ Email sent to {to_email}: {response.status_code}")
        return True

    except Exception as e:
        print(f"❌ Email error for {to_email}: {e}")
        return False