"""Metrc facilities API and local cache sync."""

from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from metrc.client import request_json
from metrc_models import MetrcFacility


def get_facilities_v2(db: Session) -> Any:
    """GET /facilities/v2/ from Metrc sandbox."""
    return request_json(
        db,
        "GET",
        "/facilities/v2/",
        workbook_section="facilities",
    )


def _parse_date(value: Any) -> Optional[date]:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "")).date()
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text[:19], fmt).date()
        except ValueError:
            continue
    return None


def _facility_id(raw: dict[str, Any]) -> Optional[int]:
    for key in ("Id", "id", "FacilityId", "facilityId"):
        val = raw.get(key)
        if val is not None:
            try:
                return int(val)
            except (TypeError, ValueError):
                pass
    return None


def _license_block(raw: dict[str, Any]) -> dict[str, Any]:
    lic = raw.get("License") or raw.get("license") or {}
    if not isinstance(lic, dict):
        return {}
    return lic


def facility_row_from_api(raw: dict[str, Any], synced_at: datetime) -> dict[str, Any]:
    lic = _license_block(raw)
    license_number = (
        lic.get("Number")
        or lic.get("number")
        or raw.get("LicenseNumber")
        or raw.get("licenseNumber")
    )
    return {
        "facility_id": _facility_id(raw),
        "license_number": (str(license_number).strip() if license_number else None),
        "facility_name": raw.get("Name") or raw.get("name"),
        "display_name": raw.get("DisplayName") or raw.get("displayName"),
        "license_type": lic.get("LicenseType") or lic.get("licenseType"),
        "start_date": _parse_date(
            raw.get("StartDate")
            or raw.get("startDate")
            or lic.get("StartDate")
            or lic.get("startDate")
        ),
        "end_date": _parse_date(
            raw.get("EndDate")
            or raw.get("endDate")
            or lic.get("EndDate")
            or lic.get("endDate")
        ),
        "raw_json": json.dumps(raw, separators=(",", ":"), default=str),
        "synced_at": synced_at,
    }


def sync_metrc_facilities(db: Session) -> dict[str, int]:
    """
    Pull GET /facilities/v2/ and upsert into metrc_facilities by license_number.
    """
    synced_at = datetime.utcnow()
    payload = get_facilities_v2(db)
    if not isinstance(payload, list):
        raise ValueError("Metrc facilities response must be a JSON array")

    inserted = 0
    updated = 0
    skipped = 0

    for item in payload:
        if not isinstance(item, dict):
            skipped += 1
            continue
        row_data = facility_row_from_api(item, synced_at)
        license_number = row_data.get("license_number")
        if not license_number:
            skipped += 1
            continue

        existing = (
            db.query(MetrcFacility)
            .filter(MetrcFacility.license_number == license_number)
            .one_or_none()
        )
        if existing is None:
            db.add(MetrcFacility(**row_data))
            inserted += 1
        else:
            for key, val in row_data.items():
                setattr(existing, key, val)
            updated += 1

    db.commit()
    return {
        "fetched": len(payload),
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "synced_at": synced_at.isoformat() + "Z",
    }
