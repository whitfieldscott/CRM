"""
Metrc live API cache and request logs (cannacore.db).

Separate from raw_metrc_licenses (Excel import registry).
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, Integer, String, Text, UniqueConstraint

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


class MetrcLocation(Base):
    __tablename__ = "metrc_locations"
    __table_args__ = (
        UniqueConstraint(
            "license_number",
            "metrc_id",
            name="uq_metrc_locations_license_metrc_id",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    metrc_id = Column(Integer, nullable=False, index=True)
    license_number = Column(String(64), nullable=False, index=True)
    name = Column(String(512), nullable=True)
    location_type_id = Column(Integer, nullable=True)
    location_type_name = Column(String(128), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    raw_json = Column(Text, nullable=True)
    synced_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)


class MetrcStrain(Base):
    __tablename__ = "metrc_strains"
    __table_args__ = (
        UniqueConstraint(
            "license_number",
            "metrc_id",
            name="uq_metrc_strains_license_metrc_id",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    metrc_id = Column(Integer, nullable=False, index=True)
    license_number = Column(String(64), nullable=False, index=True)
    name = Column(String(512), nullable=True)
    testing_status = Column(String(64), nullable=True)
    thc_level = Column(Float, nullable=True)
    cbd_level = Column(Float, nullable=True)
    indica_percentage = Column(Float, nullable=True)
    sativa_percentage = Column(Float, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    raw_json = Column(Text, nullable=True)
    synced_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)


class MetrcItem(Base):
    __tablename__ = "metrc_items"
    __table_args__ = (
        UniqueConstraint(
            "license_number",
            "metrc_id",
            name="uq_metrc_items_license_metrc_id",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    metrc_id = Column(Integer, nullable=False, index=True)
    license_number = Column(String(64), nullable=False, index=True)
    name = Column(String(512), nullable=True)
    product_category_name = Column(String(256), nullable=True)
    product_category_type = Column(String(128), nullable=True)
    quantity_type = Column(String(64), nullable=True)
    unit_of_measure_name = Column(String(64), nullable=True)
    default_lab_testing_state = Column(String(64), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
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
