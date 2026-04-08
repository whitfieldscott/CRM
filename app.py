from fastapi import FastAPI, UploadFile, File, Depends
from sqlalchemy.orm import Session
import pandas as pd

from database import SessionLocal, engine, Base
from models import Contact, Message
from schemas import MessageCreate
from email_service import send_email

app = FastAPI()

Base.metadata.create_all(bind=engine)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----------------------------
# Upload Contacts CSV
# ----------------------------
@app.post("/upload-contacts/")
async def upload_contacts(file: UploadFile = File(...), db: Session = Depends(get_db)):
    df = pd.read_csv(file.file)

    for _, row in df.iterrows():
        contact = Contact(
            name=row.get("name"),
            email=row.get("email"),
            phone=row.get("phone"),
        )
        db.add(contact)

    db.commit()

    return {"message": "Contacts uploaded successfully"}

# ----------------------------
# Save Message
# ----------------------------
@app.post("/messages/")
def create_message(message: MessageCreate, db: Session = Depends(get_db)):
    new_msg = Message(content=message.content)
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    return new_msg

# ----------------------------
# Send Emails
# ----------------------------
@app.post("/send/")
def send_messages(db: Session = Depends(get_db)):
    contacts = db.query(Contact).all()
    message = db.query(Message).order_by(Message.id.desc()).first()

    if not message:
        return {"error": "No message found"}

    results = []

    for contact in contacts:
        personalized = message.content.replace("{{name}}", contact.name or "")

        success = send_email(
            to_email=contact.email,
            subject="Message from your system",
            content=personalized
        )

        results.append({
            "email": contact.email,
            "status": "sent" if success else "failed"
        })

    return {"results": results}