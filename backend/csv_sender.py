import time
import requests
from email_service import send_email

TEST_MODE = False
TEST_EMAIL = "rooteddominion405@gmail.com"
BACKEND_URL = "http://127.0.0.1:8000"

# Throttle settings
BATCH_SIZE = 50        # emails per batch
DELAY_BETWEEN_EMAILS = 1.5   # seconds between each email
DELAY_BETWEEN_BATCHES = 60   # seconds between batches


def get_unsubscribed_emails() -> set:
    try:
        res = requests.get(f"{BACKEND_URL}/unsubscribe-list")
        if res.status_code == 200:
            return set(res.json().get("emails", []))
    except Exception as e:
        print(f"⚠️ Could not fetch unsubscribe list: {e}")
    return set()


def send_bulk_emails(df):
    """
    Expects a CLEAN dataframe with an 'email' column.
    Includes throttling and unsubscribe checking.
    """
    subject = "Available Clones - Rooted Dominion"
    
    html_message = """
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi there,</p>
        
        <p>My name is Scott Whitfield with 
        <strong>Rooted Dominion</strong>. I'm reaching out to 
        licensed Oklahoma cannabis operators regarding our 
        currently available clone inventory.</p>
        
        <p>We have healthy, Metrc-ready clones available now 
        and would love to work with your operation.</p>
        
        <p>If you're interested or have questions, feel free 
        to reply to this email or give me a call.</p>
        
        <p>
        Best,<br><br>
        <strong>Scott Whitfield</strong><br>
        Rooted Dominion<br>
        (405) xxx-xxxx<br>
        rooteddominion405@gmail.com
        </p>
    </div>
    """
    
    # Plain text version (important for spam filters)
    plain_message = """
    Hi there,

    My name is Scott Whitfield with Rooted Dominion. I'm reaching out 
    to licensed Oklahoma cannabis operators regarding our currently 
    available clone inventory.

    We have healthy, Metrc-ready clones available now and would love 
    to work with your operation.

    If you're interested or have questions, feel free to reply to this 
    email or give me a call.

    Best,
    Scott Whitfield
    Rooted Dominion
    (405) xxx-xxxx
    rooteddominion405@gmail.com
        """

    # Fetch unsubscribed emails before sending
    unsubscribed = get_unsubscribed_emails()
    print(f"🚫 Unsubscribed emails on file: {len(unsubscribed)}")

    # Filter out unsubscribed contacts
    df = df[~df["email"].isin(unsubscribed)]
    print(f"📊 Sending to {len(df)} contacts after filtering unsubscribes...")

    total_sent = 0
    total_failed = 0
    total_skipped = 0

    for i, (_, row) in enumerate(df.iterrows()):
        if i >= 5:  # LIMIT FOR TEST
            break
    
        real_email = row["email"]  

        if not real_email or "@" not in real_email:
            total_skipped += 1
            continue

        to_email = TEST_EMAIL if TEST_MODE else real_email

        print(f"📨 [{i+1}] Sending to: {real_email} → {to_email}")

        success = send_email(
            to_email=to_email,
            subject=subject,
            content=html_message,
            plain_text=plain_message
        )

        if success:
            total_sent += 1
        else:
            total_failed += 1

        # Throttle: delay between every email
        time.sleep(DELAY_BETWEEN_EMAILS)

        # Throttle: longer pause between batches
        if (i + 1) % BATCH_SIZE == 0:
            print(f"⏸️ Batch of {BATCH_SIZE} done. Pausing {DELAY_BETWEEN_BATCHES}s...")
            time.sleep(DELAY_BETWEEN_BATCHES)

    print(f"\n✅ Done — Sent: {total_sent} | ❌ Failed: {total_failed} | ⏭️ Skipped: {total_skipped}")

    return {
        "sent": total_sent,
        "failed": total_failed,
        "skipped": total_skipped
    }