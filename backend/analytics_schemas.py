from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class EmailAnalyticsResponse(BaseModel):
    total_sent: int
    total_failed: int
    total_skipped: int
    total_campaigns: int
    total_contacts: int
    total_unsubscribes: int
    last_send_date: Optional[datetime] = None
    campaigns_this_week: int
    average_send_size: float


class CampaignAnalyticsRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_name: str
    file_used: Optional[str] = None
    total_sent: int
    total_failed: int
    total_skipped: int
    date_sent: Optional[datetime] = None
    delivery_rate: float


class SendGridStatsResponse(BaseModel):
    opens: int
    clicks: int
    bounces: int
    spam_reports: int
    unsubscribes: int
    delivered: int
    requests: int
    error: Optional[str] = None
