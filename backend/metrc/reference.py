"""Read-only Metrc reference data (passthrough, no local cache)."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from metrc.client import request_json
from metrc.sync_utils import resolve_license_number, unwrap_metrc_reference


def get_location_types(
    db: Session,
    *,
    license_number: Optional[str] = None,
) -> Any:
    license_number = resolve_license_number(license_number)
    payload = request_json(
        db,
        "GET",
        "/locations/v2/types/",
        params={"licenseNumber": license_number},
        license_number=license_number,
        workbook_section="location_types",
    )
    return unwrap_metrc_reference(payload)


def get_item_categories(
    db: Session,
    *,
    license_number: Optional[str] = None,
) -> Any:
    license_number = resolve_license_number(license_number)
    payload = request_json(
        db,
        "GET",
        "/items/v2/categories",
        params={"licenseNumber": license_number},
        license_number=license_number,
        workbook_section="item_categories",
    )
    return unwrap_metrc_reference(payload)


def get_units_of_measure_active(db: Session) -> Any:
    return request_json(
        db,
        "GET",
        "/unitsofmeasure/v2/active",
        workbook_section="units_of_measure",
    )
