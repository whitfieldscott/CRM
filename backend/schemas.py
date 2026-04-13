from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class MessageCreate(BaseModel):
    content: str


# --- Contact ---


class ContactCreate(BaseModel):
    name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    license_number: Optional[str] = None
    license_type: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = "OK"
    tags: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    license_number: Optional[str] = None
    license_type: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    last_contacted: Optional[datetime] = None
    is_active: Optional[bool] = None


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    license_number: Optional[str] = None
    license_type: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    last_contacted: Optional[datetime] = None
    created_at: Optional[datetime] = None
    is_active: bool = True


# --- Client ---


class ClientCreate(BaseModel):
    name: str
    license_number: Optional[str] = None
    license_type: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = "OK"
    notes: Optional[str] = None
    is_active: bool = True


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    license_number: Optional[str] = None
    license_type: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    license_number: Optional[str] = None
    license_type: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    is_active: bool = True


class ClientNoteCreate(BaseModel):
    note: str = Field(..., min_length=1)


class ClientNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    note: str
    created_at: Optional[datetime] = None


# --- Campaign ---


class CampaignLogCreate(BaseModel):
    campaign_name: str
    file_used: Optional[str] = None
    total_sent: int = 0
    total_failed: int = 0
    total_skipped: int = 0


class CampaignLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_name: str
    file_used: Optional[str] = None
    total_sent: int
    total_failed: int
    total_skipped: int
    date_sent: Optional[datetime] = None


class EmailSendResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: Optional[int] = None
    contact_id: Optional[int] = None
    campaign_log_id: Optional[int] = None
    recipient_email: str
    subject: Optional[str] = None
    success: bool
    sent_at: Optional[datetime] = None


# --- Settings ---


class SettingsResponse(BaseModel):
    from_email: str
    sendgrid_configured: bool
    test_mode: bool


class SettingsUpdate(BaseModel):
    test_mode: bool


class CSVImportSummary(BaseModel):
    added: int
    updated: int
    skipped_invalid: int
    total_rows_processed: int
