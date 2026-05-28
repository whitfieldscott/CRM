#!/usr/bin/env python3
"""
Add Phase D normalization columns to existing backend/cannacore.db.

Safe to run multiple times (skips columns that already exist).

Usage:
  python backend/scripts/upgrade_cannacore_phase_d_schema.py
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from cannacore_database import CANNACORE_DB_PATH, engine  # noqa: E402
from sqlalchemy import inspect, text  # noqa: E402


OMMA_COLUMNS = {
    "license_validation_status": "VARCHAR(32)",
    "email_validation_status": "VARCHAR(32)",
    "duplicate_classification": "VARCHAR(48)",
    "normalization_status": "VARCHAR(32)",
    "normalized_at": "DATETIME",
}

METRC_COLUMNS = {
    "license_validation_status": "VARCHAR(32)",
    "phone_validation_status": "VARCHAR(32)",
    "duplicate_classification": "VARCHAR(48)",
    "normalization_status": "VARCHAR(32)",
    "normalized_at": "DATETIME",
}


def _existing_columns(table: str) -> set[str]:
    insp = inspect(engine)
    return {c["name"] for c in insp.get_columns(table)}


def _add_missing(table: str, spec: dict[str, str]) -> list[str]:
    existing = _existing_columns(table)
    added: list[str] = []
    with engine.begin() as conn:
        for col, sql_type in spec.items():
            if col in existing:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {sql_type}"))
            added.append(col)
    return added


def main() -> int:
    if not CANNACORE_DB_PATH.is_file():
        print(
            "Error: backend/cannacore.db not found. "
            "Run create_cannacore_db.py first.",
            file=sys.stderr,
        )
        return 1

    omma_added = _add_missing("raw_omma_licenses", OMMA_COLUMNS)
    metrc_added = _add_missing("raw_metrc_licenses", METRC_COLUMNS)

    print(f"Database: {CANNACORE_DB_PATH}")
    print("raw_omma_licenses columns added:", omma_added or "(none)")
    print("raw_metrc_licenses columns added:", metrc_added or "(none)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
