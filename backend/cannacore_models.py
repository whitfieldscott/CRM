"""
SQLAlchemy models for CannaCore license merge staging (backend/cannacore.db).

Separate from backend/models.py (Contact, Client, app.db).
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from cannacore_database import Base


class TimestampMixin:
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class SourceFile(Base, TimestampMixin):
    __tablename__ = "source_files"

    id = Column(Integer, primary_key=True, index=True)
    source_system = Column(String(32), nullable=False, index=True)  # omma | metrc
    license_category = Column(
        String(32), nullable=False, index=True
    )  # grower | processor | dispensary | ...
    file_path = Column(String(512), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_sha256 = Column(String(64), nullable=True, index=True)
    file_size_bytes = Column(Integer, nullable=True)
    sheet_name = Column(String(128), nullable=True)
    row_count = Column(Integer, nullable=True)
    source_effective_date = Column(Date, nullable=True)
    imported_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    omma_rows = relationship("RawOmmaLicense", back_populates="source_file")
    metrc_rows = relationship("RawMetrcLicense", back_populates="source_file")
    import_runs = relationship("ImportRun", back_populates="source_file")
    metrc_snapshots = relationship("MetrcSnapshot", back_populates="source_file")


class ImportRun(Base):
    __tablename__ = "import_runs"

    id = Column(Integer, primary_key=True, index=True)
    run_type = Column(
        String(64), nullable=False, index=True
    )  # raw_import | normalize | merge | snapshot_diff | contact_rebuild
    status = Column(
        String(32), nullable=False, default="pending", index=True
    )  # pending | running | success | failed
    source_file_id = Column(Integer, ForeignKey("source_files.id"), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    rows_processed = Column(Integer, nullable=True)
    rows_error = Column(Integer, nullable=True)
    log_summary = Column(Text, nullable=True)  # JSON text
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    source_file = relationship("SourceFile", back_populates="import_runs")
    license_source_links = relationship(
        "LicenseSourceLink", back_populates="import_run"
    )
    license_change_events = relationship(
        "LicenseChangeEvent", back_populates="import_run"
    )


class RawOmmaLicense(Base):
    __tablename__ = "raw_omma_licenses"
    __table_args__ = (
        UniqueConstraint("source_file_id", "row_number", name="uq_raw_omma_file_row"),
    )

    id = Column(Integer, primary_key=True, index=True)
    source_file_id = Column(
        Integer, ForeignKey("source_files.id"), nullable=False, index=True
    )
    import_run_id = Column(Integer, ForeignKey("import_runs.id"), nullable=True)
    row_number = Column(Integer, nullable=False)
    license_number_raw = Column(String(64), nullable=True)
    license_number_normalized = Column(String(64), nullable=True, index=True)
    business_name = Column(String(512), nullable=True)
    dba = Column(String(512), nullable=True)
    license_type = Column(String(128), nullable=True)
    city = Column(String(128), nullable=True)
    county = Column(String(128), nullable=True)
    expiration_raw = Column(String(64), nullable=True)
    expiration_date = Column(Date, nullable=True)
    email_raw = Column(String(320), nullable=True)
    email_normalized = Column(String(320), nullable=True, index=True)
    raw_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    source_file = relationship("SourceFile", back_populates="omma_rows")
    import_run = relationship("ImportRun")
    license_source_links = relationship(
        "LicenseSourceLink",
        back_populates="raw_omma_license",
        foreign_keys="LicenseSourceLink.raw_omma_license_id",
    )


class MetrcSnapshot(Base, TimestampMixin):
    __tablename__ = "metrc_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    source_file_id = Column(
        Integer, ForeignKey("source_files.id"), nullable=False, index=True
    )
    license_category = Column(String(32), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False, index=True)
    snapshot_month = Column(String(7), nullable=False, index=True)  # YYYY-MM
    row_count = Column(Integer, nullable=True)
    unique_license_count = Column(Integer, nullable=True)
    previous_snapshot_id = Column(
        Integer, ForeignKey("metrc_snapshots.id"), nullable=True
    )
    comparison_status = Column(
        String(32), nullable=False, default="pending"
    )  # pending | complete
    notes = Column(Text, nullable=True)

    source_file = relationship("SourceFile", back_populates="metrc_snapshots")
    previous_snapshot = relationship(
        "MetrcSnapshot", remote_side="MetrcSnapshot.id", foreign_keys=[previous_snapshot_id]
    )
    raw_metrc_rows = relationship("RawMetrcLicense", back_populates="metrc_snapshot")
    license_change_events = relationship(
        "LicenseChangeEvent", back_populates="metrc_snapshot"
    )


class RawMetrcLicense(Base):
    __tablename__ = "raw_metrc_licenses"
    __table_args__ = (
        UniqueConstraint("source_file_id", "row_number", name="uq_raw_metrc_file_row"),
    )

    id = Column(Integer, primary_key=True, index=True)
    source_file_id = Column(
        Integer, ForeignKey("source_files.id"), nullable=False, index=True
    )
    metrc_snapshot_id = Column(
        Integer, ForeignKey("metrc_snapshots.id"), nullable=True, index=True
    )
    import_run_id = Column(Integer, ForeignKey("import_runs.id"), nullable=True)
    row_number = Column(Integer, nullable=False)
    license_number_raw = Column(String(64), nullable=True)
    license_number_normalized = Column(String(64), nullable=True, index=True)
    business_name = Column(String(512), nullable=True)
    license_type = Column(String(128), nullable=True)
    address_raw = Column(String(512), nullable=True)
    address_normalized = Column(String(512), nullable=True)
    phone_raw = Column(String(64), nullable=True)
    phone_normalized = Column(String(32), nullable=True, index=True)
    raw_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    source_file = relationship("SourceFile", back_populates="metrc_rows")
    metrc_snapshot = relationship("MetrcSnapshot", back_populates="raw_metrc_rows")
    import_run = relationship("ImportRun")
    license_source_links = relationship(
        "LicenseSourceLink",
        back_populates="raw_metrc_license",
        foreign_keys="LicenseSourceLink.raw_metrc_license_id",
    )


class Company(Base, TimestampMixin):
    """Phase B: one company row per license (1:1)."""

    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    display_name = Column(String(512), nullable=True)
    legal_name = Column(String(512), nullable=True)
    primary_dba = Column(String(512), nullable=True)
    confidence_score = Column(Float, nullable=True)

    license = relationship("License", back_populates="company", uselist=False)


class License(Base, TimestampMixin):
    __tablename__ = "licenses"
    __table_args__ = (
        UniqueConstraint(
            "license_number_normalized", name="uq_licenses_normalized_number"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(
        Integer, ForeignKey("companies.id"), nullable=True, unique=True
    )
    license_number_normalized = Column(String(64), nullable=False)
    license_number_display = Column(String(64), nullable=True)
    license_prefix = Column(String(8), nullable=True, index=True)
    license_category = Column(String(32), nullable=False, index=True)
    business_name_display = Column(String(512), nullable=True)
    dba_display = Column(String(512), nullable=True)
    license_type_display = Column(String(128), nullable=True)
    city_display = Column(String(128), nullable=True)
    county_display = Column(String(128), nullable=True)
    state = Column(String(8), nullable=False, default="OK")
    address_display = Column(String(512), nullable=True)
    expiration_date = Column(Date, nullable=True)
    operational_status = Column(
        String(32), nullable=False, default="unknown", index=True
    )
    # active | inactive | unknown | omma_only | metrc_only
    marketing_caution = Column(Boolean, nullable=False, default=False)
    last_seen_in_metrc_at = Column(DateTime, nullable=True)
    last_seen_in_omma_at = Column(DateTime, nullable=True)
    merge_version = Column(Integer, nullable=False, default=1)
    merge_metadata = Column(Text, nullable=True)  # JSON: source attribution

    company = relationship("Company", back_populates="license")
    contact_points = relationship("ContactPoint", back_populates="license")
    source_links = relationship("LicenseSourceLink", back_populates="license")
    data_conflicts = relationship("DataConflict", back_populates="license")
    change_events = relationship("LicenseChangeEvent", back_populates="license")


class ContactPoint(Base, TimestampMixin):
    __tablename__ = "contact_points"
    __table_args__ = (
        UniqueConstraint(
            "license_id",
            "contact_type",
            "value_normalized",
            name="uq_contact_point_license_type_value",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    license_id = Column(Integer, ForeignKey("licenses.id"), nullable=False)
    contact_type = Column(
        String(32), nullable=False
    )  # email | phone | fax | website
    value_normalized = Column(String(320), nullable=False)
    value_display = Column(String(320), nullable=True)
    is_primary = Column(Boolean, nullable=False, default=False)
    source_system = Column(String(32), nullable=True)  # omma | metrc | manual
    source_priority = Column(Integer, nullable=True)
    first_seen_at = Column(DateTime, nullable=True)
    last_verified_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    license = relationship("License", back_populates="contact_points")


class LicenseSourceLink(Base):
    __tablename__ = "license_source_links"

    id = Column(Integer, primary_key=True, index=True)
    license_id = Column(Integer, ForeignKey("licenses.id"), nullable=False, index=True)
    raw_omma_license_id = Column(
        Integer, ForeignKey("raw_omma_licenses.id"), nullable=True, index=True
    )
    raw_metrc_license_id = Column(
        Integer, ForeignKey("raw_metrc_licenses.id"), nullable=True, index=True
    )
    import_run_id = Column(Integer, ForeignKey("import_runs.id"), nullable=True)
    link_role = Column(
        String(32), nullable=False, default="primary"
    )  # primary | secondary_facility | historical
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    license = relationship("License", back_populates="source_links")
    raw_omma_license = relationship(
        "RawOmmaLicense",
        back_populates="license_source_links",
        foreign_keys=[raw_omma_license_id],
    )
    raw_metrc_license = relationship(
        "RawMetrcLicense",
        back_populates="license_source_links",
        foreign_keys=[raw_metrc_license_id],
    )
    import_run = relationship("ImportRun", back_populates="license_source_links")


class DataConflict(Base, TimestampMixin):
    __tablename__ = "data_conflicts"
    id = Column(Integer, primary_key=True, index=True)
    license_id = Column(Integer, ForeignKey("licenses.id"), nullable=False, index=True)
    conflict_type = Column(String(64), nullable=False, index=True)
    field_name = Column(String(64), nullable=True)
    omma_value = Column(Text, nullable=True)
    metrc_value = Column(Text, nullable=True)
    merged_chosen_value = Column(Text, nullable=True)
    conflict_status = Column(
        String(32), nullable=False, default="open", index=True
    )
    # open | accepted_omma | accepted_metrc | accepted_manual | ignored
    severity = Column(String(16), nullable=True)  # low | medium | high
    detected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(128), nullable=True)
    notes = Column(Text, nullable=True)

    license = relationship("License", back_populates="data_conflicts")


class LicenseChangeEvent(Base):
    __tablename__ = "license_change_events"
    id = Column(Integer, primary_key=True, index=True)
    license_id = Column(Integer, ForeignKey("licenses.id"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    field_name = Column(String(64), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    metrc_snapshot_id = Column(
        Integer, ForeignKey("metrc_snapshots.id"), nullable=True, index=True
    )
    import_run_id = Column(Integer, ForeignKey("import_runs.id"), nullable=True)
    confidence = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    license = relationship("License", back_populates="change_events")
    metrc_snapshot = relationship(
        "MetrcSnapshot", back_populates="license_change_events"
    )
    import_run = relationship("ImportRun", back_populates="license_change_events")
