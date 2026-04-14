import os
from pathlib import Path
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "admin@arkonesystems.com")
TEMPLATE_ID = os.getenv("SENDGRID_TEMPLATE_ID")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")


def send_email(
    to_email: str,
    subject: str,
    content: str,
    plain_text: str = "",
    *,
    force_html_body: bool = False,
) -> bool:
    if not SENDGRID_API_KEY:
        print("❌ Missing SENDGRID_API_KEY")
        return False

    try:
        unsubscribe_url = f"{BACKEND_URL}/unsubscribe?email={to_email}"

        if TEMPLATE_ID and not force_html_body:
            # Use SendGrid dynamic template
            msg = Mail(
                from_email=FROM_EMAIL,
                to_emails=to_email,
            )
            msg.template_id = TEMPLATE_ID
            msg.dynamic_template_data = {
                "unsubscribe_url": unsubscribe_url
            }
        else:
            # Use raw HTML
            html = (content or "<p>No content</p>")
            html = html.replace("{{unsubscribe_url}}", unsubscribe_url)
            html = html.replace("{{UNSUBSCRIBE_URL}}", unsubscribe_url)
            html = html.replace("{{{unsubscribe_url}}}", unsubscribe_url)

            if not subject or not subject.strip():
                subject = "Rooted Dominion — Clone Availability"

            msg = Mail(
                from_email=FROM_EMAIL,
                to_emails=to_email,
                subject=subject,
                html_content=html,
                plain_text_content=plain_text.strip() if plain_text and plain_text.strip() else "Please view this email in an HTML-compatible email client."
            )

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(msg)
        print(f"✅ Email sent to {to_email}: {response.status_code}")
        return True

    except Exception as e:
        print(f"❌ Email error for {to_email}: {e}")
        return False