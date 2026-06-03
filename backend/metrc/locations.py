"""Metrc locations API and local cache sync."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from metrc.client import request_json
from metrc.sync_utils import (
    extract_metrc_list,
    metrc_id,
    raw_json_dumps,
    resolve_license_number,
    upsert_license_scoped_rows,
)
from metrc_models import MetrcLocation


def _optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _fetch_locations(
    db: Session,
    license_number: str,
    path: str,
    *,
    is_active: bool,
    synced_at: datetime,
) -> list[dict[str, Any]]:
    payload = request_json(
        db,
        "GET",
        path,
        params={"licenseNumber": license_number},
        license_number=license_number,
        workbook_section="locations",
    )
    if not isinstance(payload, list):
        payload = extract_metrc_list(payload, context=path)

    rows: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        mid = metrc_id(item)
        if mid is None:
            continue
        rows.append(
            {
                "metrc_id": mid,
                "license_number": license_number,
                "name": item.get("Name") or item.get("name"),
                "location_type_id": _optional_int(
                    item.get("LocationTypeId") or item.get("locationTypeId")
                ),
                "location_type_name": item.get("LocationTypeName")
                or item.get("locationTypeName"),
                "is_active": is_active,
                "raw_json": raw_json_dumps(item),
                "synced_at": synced_at,
            }
        )
    return rows


def sync_metrc_locations(
    db: Session,
    *,
    license_number: str | None = None,
    include_inactive: bool = False,
) -> dict[str, Any]:
    """Pull location lists from Metrc and upsert into metrc_locations."""
    license_number = resolve_license_number(license_number)
    synced_at = datetime.utcnow()

    active_rows = _fetch_locations(
        db,
        license_number,
        "/locations/v2/active",
        is_active=True,
        synced_at=synced_at,
    )
    inactive_rows: list[dict[str, Any]] = []
    if include_inactive:
        inactive_rows = _fetch_locations(
            db,
            license_number,
            "/locations/v2/inactive",
            is_active=False,
            synced_at=synced_at,
        )

    stats = upsert_license_scoped_rows(
        db,
        MetrcLocation,
        license_number=license_number,
        rows=active_rows + inactive_rows,
        synced_at=synced_at,
    )
    stats["fetched"] = len(active_rows) + len(inactive_rows)
    return stats
