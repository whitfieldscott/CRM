#!/usr/bin/env python3
"""
Create backend/cannacore.db and all CannaCore staging tables.

Read-only with respect to app.db and raw Excel files — schema only.

Usage (from repo root):
  python backend/scripts/create_cannacore_db.py
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from cannacore_database import CANNACORE_DB_PATH, engine  # noqa: E402
from cannacore_models import Base  # noqa: E402,F401 — registers all models


def main() -> int:
    existed = CANNACORE_DB_PATH.is_file()
    Base.metadata.create_all(bind=engine)
    tables = sorted(Base.metadata.tables.keys())

    print(f"CannaCore database: {CANNACORE_DB_PATH}")
    print(f"Previously existed: {existed}")
    print(f"Tables created ({len(tables)}):")
    for name in tables:
        print(f"  - {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
