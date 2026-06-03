#!/usr/bin/env python3
"""
Seed Oklahoma Metrc sandbox master data for Phase 2.2.

Creates locations, strains, and items (skips names that already exist), then syncs
to cannacore.db cache tables.

Usage (repo root):
  python backend/scripts/seed_metrc_sandbox_master_data.py
  python backend/scripts/seed_metrc_sandbox_master_data.py --license SF-SBX-OK-3-8701
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from cannacore_database import SessionLocal  # noqa: E402
from metrc.client import request_json  # noqa: E402
from metrc.errors import MetrcError  # noqa: E402
from metrc.items import sync_metrc_items  # noqa: E402
from metrc.locations import sync_metrc_locations  # noqa: E402
from metrc.strains import sync_metrc_strains  # noqa: E402
from metrc.sync_utils import extract_metrc_list, resolve_license_number  # noqa: E402

LOCATION_TYPE = "Indoor Grow"
LOCATION_NAMES = [
    "Mother Room",
    "Clone Room",
    "Veg A",
    "Veg B",
    "Flower A",
    "Flower B",
    "Dry Room",
    "Trim Room",
    "Vault",
    "Quarantine",
]

STRAIN_NAMES = [
    "Blue Dream",
    "Gorilla Glue #4",
    "Wedding Cake",
    "GMO",
    "Ice Cream Cake",
    "MAC 1",
    "Gelato 41",
    "Permanent Marker",
    "Gary Payton",
    "White Truffle",
]

ITEM_SPECS: list[tuple[str, str, str]] = [
    ("Clone", "Immature Plants", "Each"),
    ("Rooted Clone", "Immature Plants", "Each"),
    ("Veg Plant", "Immature Plants", "Each"),
    ("Flowering Plant", "Mature Plants", "Each"),
    ("Wet Harvest", "Whole Wet Plant", "Grams"),
    ("Dry Harvest", "Flower & Buds bulk", "Grams"),
    ("Bulk Flower", "Flower & Buds bulk", "Grams"),
    ("Trim", "Kief (Count)", "Each"),
    ("Shake", "Shake/Trim bulk", "Grams"),
    ("Fresh Frozen", "Whole Wet Plant", "Grams"),
]


def _existing_names(db, path: str, license_number: str) -> set[str]:
    payload = request_json(
        db,
        "GET",
        path,
        params={"licenseNumber": license_number},
        license_number=license_number,
        workbook_section="seed_probe",
    )
    rows = extract_metrc_list(payload, context=path)
    names: set[str] = set()
    for row in rows:
        if isinstance(row, dict):
            n = row.get("Name") or row.get("name")
            if n:
                names.add(str(n).strip())
    return names


def _create_locations(db, license_number: str) -> dict[str, int]:
    existing = _existing_names(db, "/locations/v2/active", license_number)
    created = 0
    skipped = 0
    for name in LOCATION_NAMES:
        if name in existing:
            skipped += 1
            continue
        body = [{"Name": name, "LocationTypeName": LOCATION_TYPE}]
        request_json(
            db,
            "POST",
            "/locations/v2/",
            params={"licenseNumber": license_number},
            json_body=body,
            license_number=license_number,
            workbook_section="seed_locations",
        )
        created += 1
    return {"created": created, "skipped": skipped}


def _create_strains(db, license_number: str) -> dict[str, int]:
    existing = _existing_names(db, "/strains/v2/active", license_number)
    created = 0
    skipped = 0
    for name in STRAIN_NAMES:
        if name in existing:
            skipped += 1
            continue
        body = [
            {
                "Name": name,
                "TestingStatus": "None",
                "ThcLevel": None,
                "CbdLevel": None,
                "IndicaPercentage": 50.0,
                "SativaPercentage": 50.0,
            }
        ]
        request_json(
            db,
            "POST",
            "/strains/v2/",
            params={"licenseNumber": license_number},
            json_body=body,
            license_number=license_number,
            workbook_section="seed_strains",
        )
        created += 1
    return {"created": created, "skipped": skipped}


def _create_items(db, license_number: str) -> dict[str, int]:
    existing = _existing_names(db, "/items/v2/active", license_number)
    created = 0
    skipped = 0
    default_strain = STRAIN_NAMES[0]
    for name, category, uom in ITEM_SPECS:
        if name in existing:
            skipped += 1
            continue
        unit_weight = 1.0 if category == "Kief (Count)" else None
        unit_weight_uom = "Grams" if category == "Kief (Count)" else None
        body = [
            {
                "ItemCategory": category,
                "Name": name,
                "UnitOfMeasure": uom,
                "Strain": default_strain,
                "UnitThcPercent": None,
                "UnitThcContent": None,
                "UnitThcContentUnitOfMeasure": None,
                "UnitCbdPercent": None,
                "UnitCbdContent": None,
                "UnitCbdContentUnitOfMeasure": None,
                "UnitVolume": None,
                "UnitVolumeUnitOfMeasure": None,
                "UnitWeight": unit_weight,
                "UnitWeightUnitOfMeasure": unit_weight_uom,
                "ServingSize": None,
                "SupplyDurationDays": None,
                "NumberOfDoses": None,
                "PublicIngredients": None,
                "Description": f"CannaCore Phase 2.2 sandbox — {name}",
                "ProductPhotoDescription": None,
                "LabelPhotoDescription": None,
                "PackagingPhotoDescription": None,
                "ProductPDFDocumentDescription": None,
                "IsUsed": False,
            }
        ]
        try:
            request_json(
                db,
                "POST",
                "/items/v2/",
                params={"licenseNumber": license_number},
                json_body=body,
                license_number=license_number,
                workbook_section="seed_items",
            )
            created += 1
        except MetrcError as e:
            print(f"  item {name!r} failed: {e.detail}", file=sys.stderr)
    return {"created": created, "skipped": skipped}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--license", default=None, help="Facility license override")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        license_number = resolve_license_number(args.license)
        print(f"Seeding sandbox master data for {license_number}")

        loc_stats = _create_locations(db, license_number)
        print("Locations:", loc_stats)
        strain_stats = _create_strains(db, license_number)
        print("Strains:", strain_stats)
        item_stats = _create_items(db, license_number)
        print("Items:", item_stats)

        print("Syncing cache tables...")
        print("  locations:", sync_metrc_locations(db, license_number=license_number))
        print("  strains:", sync_metrc_strains(db, license_number=license_number))
        print("  items:", sync_metrc_items(db, license_number=license_number))
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
