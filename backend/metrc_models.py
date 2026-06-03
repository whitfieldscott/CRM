"""
Metrc live API cache and request logs (cannacore.db).

Separate from raw_metrc_licenses (Excel import registry).
"""

from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Integer, String, Text, UniqueConstraint

from cannacore_database import Base


class MetrcFacility(Base):
    __tablename__ = "metrc_facilities"
    __table_args__ = (
        UniqueConstraint("license_number", name="uq_metrc_facilities_license_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    facility_id = Column(Integer, nullable=True, index=True)
    license_number = Column(String(64), nullable=False)
    facility_name = Column(String(512), nullable=True)
    display_name = Column(String(512), nullable=True)
    license_type = Column(String(128), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    raw_json = Column(Text, nullable=True)
    synced_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)


class MetrcApiRequestLog(Base):
    __tablename__ = "metrc_api_request_logs"

    id = Column(Integer, primary_key=True, index=True)
    correlation_id = Column(String(36), nullable=False, index=True)
    workbook_section = Column(String(64), nullable=True, index=True)
    http_method = Column(String(16), nullable=False)
    path = Column(String(512), nullable=False)
    query_string = Column(Text, nullable=True)
    license_number = Column(String(64), nullable=True, index=True)
    request_body = Column(Text, nullable=True)
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    environment = Column(String(16), nullable=False, default="sandbox")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
