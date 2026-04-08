import pandas as pd
from email_service import send_email

TEST_MODE = True
TEST_EMAIL = "scottwhitfield1977@gmail.com"

def send_bulk_emails(csv_file):
    df = pd.read_csv(csv_file)

    if "Dispensary" in csv_file:
        subject = "Update for dispensaries"
        message = "<strong>Dispensary update</strong>"

    elif "Grower" in csv_file:
        subject = "Update for growers"
        message = "<strong>Grower update</strong>"

    elif "Processor" in csv_file:
        subject = "Update for processors"
        message = "<strong>Processor update</strong>"

    else:
        subject = "Hello"
        message = "<strong>Hello there!</strong>"

    # Debug once safely
    print("CSV Columns:", df.columns)

    for _, row in df.iterrows():
        real_email = row.get('email')

        if not real_email:
            continue  # skip rows with no email

        to_email = TEST_EMAIL if TEST_MODE else real_email

        print(f"Would send to: {real_email} → actually sending to: {to_email}")

        send_email(
            to_email=to_email,
            subject=subject,
            content=message
        )

    return "Emails sent"