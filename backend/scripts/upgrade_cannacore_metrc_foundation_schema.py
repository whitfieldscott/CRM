#!/usr/bin/env python3
"""
Add Metrc foundation tables to cannacore.db (metrc_facilities, metrc_api_request_logs).

Usage (from repo root):
  python backend/scripts/upgrade_cannacore_metrc_foundation_schema.py
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


def main() -> int:
    Base.metadata.create_all(bind=engine)
    tables = sorted(
        t for t in Base.metadata.tables.keys() if t.startswith("metrc_")
    )
    print(f"CannaCore database: {CANNACORE_DB_PATH}")
    print("Metrc foundation tables ensured:")
    for name in tables:
        print(f"  - {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
