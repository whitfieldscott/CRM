from fastapi import FastAPI, HTTPException, Depends
from csv_sender import send_bulk_emails
from email_service import send_email  # ✅ add this import
from fastapi import HTTPException
import pandas as pd
from database import SessionLocal, engine, Base
from models import Unsubscribe
from sqlalchemy.orm import Session

app = FastAPI()

def load_and_clean_csv(file_path: str):
    try:
        df = pd.read_csv(file_path)

        # Normalize columns
        df.columns = [col.lower().strip().replace(" ", "_").replace("-", "_") for col in df.columns]

        if "email" not in df.columns:
            raise HTTPException(status_code=400, detail="CSV must contain an 'email' column")

        # Clean emails
        df["email"] = df["email"].astype(str).str.strip().str.lower()
        df = df[df["email"] != "nan"]
        df = df[df["email"].str.contains("@", na=False)]
        df = df.drop_duplicates(subset=["email"])

        return df

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {e}")

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
    file_path = f"../data/{file_name}"

    df = load_and_clean_csv(file_path)

    result = send_bulk_emails(df)

    return {
        "message": "Emails sent",
        "total_sent": len(df),
        "result": result
    }

@app.get("/preview-csv")
def preview_csv(file_name: str):
    file_path = f"../data/{file_name}"

    df = load_and_clean_csv(file_path)

    preview_data = df.head(5).to_dict(orient="records")

    return {
        "total_rows": len(df),
        "columns": list(df.columns),
        "preview": preview_data
    }

@app.get("/confirm-send")
def confirm_send(file_name: str):
    file_path = f"../data/{file_name}"

    df = load_and_clean_csv(file_path)

    return {
        "file_name": file_name,
        "total_valid_emails": len(df),
        "sample_emails": df["email"].head(5).tolist(),
        "ready_to_send": True
    }

# Create all tables on startup
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/unsubscribe")
def unsubscribe(email: str, db: Session = Depends(get_db)):
    # Check if already unsubscribed
    existing = db.query(Unsubscribe).filter(
        Unsubscribe.email == email.lower().strip()
    ).first()

    if not existing:
        record = Unsubscribe(email=email.lower().strip())
        db.add(record)
        db.commit()

    return {
        "message": f"{email} has been unsubscribed successfully.",
        "status": "unsubscribed"
    }

@app.get("/unsubscribe-list")
def get_unsubscribes(db: Session = Depends(get_db)):
    records = db.query(Unsubscribe).all()
    return {
        "total": len(records),
        "emails": [r.email for r in records]
    }

@app.delete("/unsubscribe")
def remove_unsubscribe(email: str, db: Session = Depends(get_db)):
    record = db.query(Unsubscribe).filter(
        Unsubscribe.email == email.lower().strip()
    ).first()

    if record:
        db.delete(record)
        db.commit()
        return {"message": f"{email} removed from unsubscribe list"}

    return {"message": f"{email} was not on the unsubscribe list"}