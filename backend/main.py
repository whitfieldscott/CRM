from fastapi import FastAPI
from csv_sender import send_bulk_emails
from email_service import send_email  # ✅ add this import

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Backend is running 🚀"}

@app.get("/test-email")
def test_email():
    send_email(
        to_email="scottwhitfield1977@gmail.com",
        subject="Test Email",
        content="<strong>This is a test email</strong>"
    )
    return {"status": "Test email sent"}

@app.post("/send-bulk")
def send_bulk(file_name: str):
    result = send_bulk_emails(f"../data/{file_name}")
    return {"result": result}