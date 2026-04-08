from backend.csv_sender import send_bulk_emails

files = [
    "data/Oklahoma Dispensary Records Final Output 18-01-2026.csv",
    "data/Oklahoma Processor Records Final Output 18-01-2026.csv",
    "data/Oklahoma Grower Records Final Output 18-01-2026.csv"
]

for file in files:
    print(f"Sending emails for {file}...")
    send_bulk_emails(file)