#!/usr/bin/env python3
"""
Add Metrc master-data tables to cannacore.db.

Usage (from repo root):
  python backend/scripts/upgrade_cannacore_metrc_master_data_schema.py
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from cannacore_database import CANNACORE_DB_PATH, Base, engine  # noqa: E402
import cannacore_models  # noqa: E402, F401
import metrc_models  # noqa: E402, F401

MASTER_DATA_TABLES = (
    "metrc_locations",
    "metrc_strains",
    "metrc_items",
)


def main() -> int:
    Base.metadata.create_all(bind=engine)
    print(f"CannaCore database: {CANNACORE_DB_PATH}")
    print("Metrc master-data tables ensured:")
    for name in MASTER_DATA_TABLES:
        print(f"  - {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
