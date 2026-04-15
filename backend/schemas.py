from datetime import datetime
from typing import Literal, Optional

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


class SmsCampaignLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_name: str
    file_used: Optional[str] = None
    total_sent: int
    total_failed: int
    total_skipped: int
    date_sent: Optional[datetime] = None


class SmsContactsResponse(BaseModel):
    file_name: str
    total_rows_in_file: int
    total_valid_phones: int
    rows_without_valid_phone: int
    sample_phones: list[str]
    daily_limit: int
    warmup_day: int
    warmup_complete: bool
    test_mode: bool
    twilio_configured: bool
    test_sms_to_configured: bool


class SmsSendBody(BaseModel):
    file_name: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=160)
    campaign_name: Optional[str] = None
    sms_test_mode: bool = False
    sms_test_destination: Optional[str] = Field(
        default=None,
        description="E.164 test destination when sms_test_mode is on (overrides TEST_SMS_TO).",
    )


class CampaignTemplateBody(BaseModel):
    html: str


class CampaignSendBody(BaseModel):
    campaign_name: str
    file_name: str
    test_email: Optional[str] = Field(
        default=None,
        description="When set, all sends go to this address (UI test mode).",
    )


class IntegerIdListBody(BaseModel):
    ids: list[int] = Field(..., min_length=1)


class FromContactsBody(BaseModel):
    contact_ids: list[int] = Field(..., min_length=1)


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


class TabularImportRow(BaseModel):
    name: Optional[str] = None
    business: Optional[str] = None
    phone: Optional[str] = None
    email: str


class TabularImportPreviewResponse(BaseModel):
    preview: list[TabularImportRow]
    total_rows: int
    total_valid: int


class TabularImportConfirmSummary(BaseModel):
    contacts_added: int
    contacts_updated: int
    clients_created: int
    clients_updated: int
    skipped_invalid: int
    total_rows_processed: int
