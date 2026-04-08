import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")

def send_email(to_email, subject, content):
    if not SENDGRID_API_KEY:
        print("❌ Missing SENDGRID_API_KEY")
        return False

    try:
        message = Mail(
            from_email="scottwhitfield1977@gmail.com",  # ⚠️ must be verified in SendGrid
            to_emails=to_email,
            subject=subject,
            html_content=content,
        )

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)

        print(f"✅ Email sent: {response.status_code}")
        return True

    except Exception as e:
        print("❌ Email error:", e)
        return False