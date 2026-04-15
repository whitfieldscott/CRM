from datetime import datetime
from typing import Literal, Optional

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


class SendGridSeriesPoint(BaseModel):
    period: str
    delivered: int
    opens: int
    clicks: int
    bounces: int


class SendGridSeriesResponse(BaseModel):
    granularity: str
    points: list[SendGridSeriesPoint]
    error: Optional[str] = None


class SuppressionEntry(BaseModel):
    email: str
    reason: str
    date: str
    marked_follow_up: bool = False


class SuppressionListResponse(BaseModel):
    items: list[SuppressionEntry]
    error: Optional[str] = None


class SuppressionActionBody(BaseModel):
    kind: Literal["bounce", "unsubscribe"]
    email: str


class SmsSummaryAnalyticsResponse(BaseModel):
    total_sent: int
    total_failed: int
    total_skipped: int


class SmsSeriesPoint(BaseModel):
    period: str
    sent: int
    failed: int
    skipped: int


class SmsSeriesResponse(BaseModel):
    granularity: str
    points: list[SmsSeriesPoint]
    error: Optional[str] = None
