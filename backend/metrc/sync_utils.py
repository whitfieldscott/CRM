"""Shared helpers for Metrc master-data sync."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional, TypeVar

from sqlalchemy.orm import Session

from metrc.config import get_metrc_settings

ModelT = TypeVar("ModelT")


def resolve_license_number(license_number: Optional[str]) -> str:
    settings = get_metrc_settings()
    resolved = (license_number or settings.default_license_number or "").strip()
    if not resolved:
        raise ValueError(
            "license is required (query param license= or METRC_LICENSE_NUMBER in .env)."
        )
    return resolved


def metrc_id(raw: dict[str, Any]) -> Optional[int]:
    for key in ("Id", "id"):
        val = raw.get(key)
        if val is not None:
            try:
                return int(val)
            except (TypeError, ValueError):
                pass
    return None


def raw_json_dumps(raw: dict[str, Any]) -> str:
    return json.dumps(raw, separators=(",", ":"), default=str)


def extract_metrc_list(payload: Any, *, context: str) -> list[Any]:
    """Normalize Metrc list responses (raw array or paginated Data wrapper)."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        data = payload.get("Data")
        if isinstance(data, list):
            return data
    raise ValueError(f"Metrc {context} response must be a JSON array or paginated Data list")


def unwrap_metrc_reference(payload: Any) -> Any:
    """Unwrap paginated Data for reference endpoints when present."""
    if isinstance(payload, dict) and "Data" in payload:
        return payload["Data"]
    return payload


def upsert_license_scoped_rows(
    db: Session,
    model: type[ModelT],
    *,
    license_number: str,
    rows: list[dict[str, Any]],
    synced_at: datetime,
) -> dict[str, int]:
    inserted = 0
    updated = 0
    skipped = 0

    for row_data in rows:
        metrc_row_id = row_data.get("metrc_id")
        if metrc_row_id is None:
            skipped += 1
            continue

        existing = (
            db.query(model)
            .filter(
                model.license_number == license_number,  # type: ignore[attr-defined]
                model.metrc_id == metrc_row_id,  # type: ignore[attr-defined]
            )
            .one_or_none()
        )
        if existing is None:
            db.add(model(**row_data))
            inserted += 1
        else:
            for key, val in row_data.items():
                setattr(existing, key, val)
            updated += 1

    db.commit()
    return {
        "license_number": license_number,
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "synced_at": synced_at.isoformat() + "Z",
    }
