from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database import Base


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    company = Column(String, nullable=True)
    license_number = Column(String, nullable=True)
    license_type = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True, default="OK")
    tags = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    last_contacted = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    email_sends = relationship("EmailSendRecord", back_populates="contact")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)


class Unsubscribe(Base):
    __tablename__ = "unsubscribes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    unsubscribed_at = Column(DateTime, default=datetime.utcnow)


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    license_number = Column(String, nullable=True)
    license_type = Column(String, nullable=True)
    primary_contact_name = Column(String, nullable=True)
    primary_contact_email = Column(String, nullable=True, index=True)
    primary_contact_phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True, default="OK")
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    notes_timeline = relationship(
        "ClientNote",
        back_populates="client",
        cascade="all, delete-orphan",
    )
    email_sends = relationship("EmailSendRecord", back_populates="client")


class ClientNote(Base):
    __tablename__ = "client_notes"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    note = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="notes_timeline")


class CampaignLog(Base):
    __tablename__ = "campaign_logs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String, nullable=False)
    file_used = Column(String, nullable=True)
    total_sent = Column(Integer, default=0)
    total_failed = Column(Integer, default=0)
    total_skipped = Column(Integer, default=0)
    date_sent = Column(DateTime, default=datetime.utcnow)

    email_sends = relationship("EmailSendRecord", back_populates="campaign_log")


class SmsCampaignLog(Base):
    """SMS bulk sends — same aggregate fields as CampaignLog."""

    __tablename__ = "sms_campaign_logs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_name = Column(String, nullable=False)
    file_used = Column(String, nullable=True)
    total_sent = Column(Integer, default=0)
    total_failed = Column(Integer, default=0)
    total_skipped = Column(Integer, default=0)
    date_sent = Column(DateTime, default=datetime.utcnow)


class EmailSendRecord(Base):
    """Per-recipient send history (supports GET /clients/{id}/emails)."""

    __tablename__ = "email_send_records"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True, index=True)
    campaign_log_id = Column(Integer, ForeignKey("campaign_logs.id"), nullable=True, index=True)
    recipient_email = Column(String, nullable=False, index=True)
    subject = Column(String, nullable=True)
    success = Column(Boolean, default=True)
    sent_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="email_sends")
    contact = relationship("Contact", back_populates="email_sends")
    campaign_log = relationship("CampaignLog", back_populates="email_sends")
