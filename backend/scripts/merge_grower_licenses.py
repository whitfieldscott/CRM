#!/usr/bin/env python3
"""
Phase E — merge normalized OMMA + Metrc grower rows into cannacore.db merged layer.

Phase E.1: if no Metrc row with duplicate_classification=none, promote one
exact_duplicate_row as primary (still excludes missing_license_quarantine).

Growers only. Does not touch app.db or raw_json.

Usage:
  python backend/scripts/merge_grower_licenses.py --dry-run
  python backend/scripts/merge_grower_licenses.py
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
REPORTS_DIR = REPO_ROOT / "data" / "reports" / "merge"

EXCLUDED_FROM_ANY = frozenset({"missing_license_quarantine"})

def _setup_path() -> None:
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))


def _check_db() -> None:
    from cannacore_database import CANNACORE_DB_PATH

    if not CANNACORE_DB_PATH.is_file():
        print(
            "Error: backend/cannacore.db not found.\n"
            "Run create_cannacore_db.py and import/normalize scripts first.",
            file=sys.stderr,
        )
        raise SystemExit(1)


def _norm_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", str(value).strip()).upper()


def _mask_license(lic: Optional[str]) -> str:
    if not lic or len(lic) < 5:
        return ""
    return lic[:4] + "***" + lic[-2:]


def _names_differ(a: Optional[str], b: Optional[str]) -> bool:
    na, nb = _norm_text(a), _norm_text(b)
    if not na or not nb:
        return False
    return na != nb


@dataclass
class MergeSummary:
    dry_run: bool = False
    omma_unique_licenses: int = 0
    metrc_unique_valid_licenses: int = 0
    matched: int = 0
    omma_only: int = 0
    metrc_only: int = 0
    companies_inserted: int = 0
    licenses_inserted: int = 0
    contact_points_inserted: int = 0
    source_links_inserted: int = 0
    conflicts_created: int = 0
    missing_emails: int = 0
    missing_phones: int = 0
    reports_written: list[str] = field(default_factory=list)


@dataclass
class GrowerBundle:
    license_norm: str
    omma_row: Any = None
    metrc_primary: Any = None
    metrc_all_rows: list = field(default_factory=list)
    omma_rows: list = field(default_factory=list)
    match_type: str = ""  # matched | omma_only | metrc_only


def _load_grower_raw_rows(db):
    from cannacore_models import RawMetrcLicense, RawOmmaLicense, SourceFile

    omma_file_ids = [
        r[0]
        for r in db.query(SourceFile.id)
        .filter(
            SourceFile.source_system == "omma",
            SourceFile.license_category == "grower",
        )
        .all()
    ]
    metrc_file_ids = [
        r[0]
        for r in db.query(SourceFile.id)
        .filter(
            SourceFile.source_system == "metrc",
            SourceFile.license_category == "grower",
        )
        .all()
    ]

    omma_rows = (
        db.query(RawOmmaLicense)
        .filter(RawOmmaLicense.source_file_id.in_(omma_file_ids))
        .all()
        if omma_file_ids
        else []
    )
    metrc_rows = (
        db.query(RawMetrcLicense)
        .filter(RawMetrcLicense.source_file_id.in_(metrc_file_ids))
        .all()
        if metrc_file_ids
        else []
    )
    return omma_rows, metrc_rows


def _pick_primary_metrc(rows: list) -> Optional[Any]:
    """
    Primary selection (E.1):
    1. Prefer duplicate_classification == none
    2. Else promote one exact_duplicate_row
    3. Else fall back to other non-quarantine rows (e.g. duplicate_metrc_license)
    """
    valid = [r for r in rows if r.license_validation_status == "valid"]
    if not valid:
        return None

    def address_len(r) -> int:
        return len(r.address_normalized or r.address_raw or "")

    def row_sort(r):
        return (-address_len(r), r.row_number)

    clean = [r for r in valid if (r.duplicate_classification or "none") == "none"]
    if clean:
        return sorted(clean, key=row_sort)[0]

    exact_dupes = [
        r for r in valid if (r.duplicate_classification or "") == "exact_duplicate_row"
    ]
    if exact_dupes:
        return sorted(exact_dupes, key=row_sort)[0]

    other = [
        r
        for r in valid
        if (r.duplicate_classification or "") not in EXCLUDED_FROM_ANY
    ]
    if other:
        return sorted(other, key=row_sort)[0]
    return None


def _build_bundles(omma_rows: list, metrc_rows: list) -> dict[str, GrowerBundle]:
    omma_by_lic: dict[str, list] = defaultdict(list)
    metrc_by_lic: dict[str, list] = defaultdict(list)

    for r in omma_rows:
        if r.license_validation_status != "valid" or not r.license_number_normalized:
            continue
        omma_by_lic[r.license_number_normalized].append(r)

    for r in metrc_rows:
        if (r.duplicate_classification or "") in EXCLUDED_FROM_ANY:
            continue
        if r.license_validation_status != "valid" or not r.license_number_normalized:
            continue
        metrc_by_lic[r.license_number_normalized].append(r)

    all_keys = set(omma_by_lic) | set(metrc_by_lic)
    bundles: dict[str, GrowerBundle] = {}

    for lic in all_keys:
        omma_list = omma_by_lic.get(lic, [])
        metrc_list = metrc_by_lic.get(lic, [])
        primary = _pick_primary_metrc(metrc_list) if metrc_list else None

        if omma_list and primary:
            match_type = "matched"
        elif omma_list:
            match_type = "omma_only"
        elif primary:
            match_type = "metrc_only"
        else:
            continue

        bundles[lic] = GrowerBundle(
            license_norm=lic,
            omma_row=omma_list[0] if omma_list else None,
            omma_rows=omma_list,
            metrc_primary=primary,
            metrc_all_rows=metrc_list,
            match_type=match_type,
        )
    return bundles


def _detect_conflicts(
    bundle: GrowerBundle,
) -> list[dict[str, Any]]:
    """Return conflict dicts using omma_value / metrc_value (source_a/b)."""
    conflicts: list[dict[str, Any]] = []
    o, m = bundle.omma_row, bundle.metrc_primary

    if bundle.match_type != "matched":
        if bundle.match_type == "omma_only":
            if not (o and o.email_normalized):
                conflicts.append(
                    _conflict("missing_email", "email", None, None, "low")
                )
        if bundle.match_type == "metrc_only":
            if not (m and m.phone_normalized):
                conflicts.append(
                    _conflict("missing_phone", "phone", None, None, "low")
                )
        return conflicts

    assert o and m

    if _names_differ(o.business_name, m.business_name):
        conflicts.append(
            _conflict(
                "business_name_mismatch",
                "business_name",
                o.business_name,
                m.business_name,
                "medium",
            )
        )

    if o.dba and _names_differ(o.dba, m.business_name):
        conflicts.append(
            _conflict("dba_mismatch", "dba", o.dba, m.business_name, "medium")
        )

    if _names_differ(o.license_type, m.license_type):
        conflicts.append(
            _conflict(
                "license_type_mismatch",
                "license_type",
                o.license_type,
                m.license_type,
                "medium",
            )
        )

    if o.city and m.address_normalized and _norm_text(o.city) not in _norm_text(
        m.address_normalized
    ):
        conflicts.append(
            _conflict("city_mismatch", "city", o.city, m.address_normalized, "medium")
        )

    if o.county and m.address_normalized and _norm_text(o.county) not in _norm_text(
        m.address_normalized
    ):
        conflicts.append(
            _conflict(
                "county_mismatch",
                "county",
                o.county,
                m.address_normalized,
                "medium",
            )
        )

    if o.city or o.county:
        omma_loc = f"{o.city or ''}, {o.county or ''}".strip(", ")
        if m.address_raw and _names_differ(omma_loc, m.address_raw):
            conflicts.append(
                _conflict(
                    "address_mismatch",
                    "address",
                    omma_loc,
                    m.address_raw,
                    "medium",
                )
            )

    if not o.email_normalized:
        conflicts.append(_conflict("missing_email", "email", None, None, "low"))

    if not m.phone_normalized:
        conflicts.append(_conflict("missing_phone", "phone", None, None, "low"))

    return conflicts


def _conflict(
    conflict_type: str,
    field_name: str,
    omma_val: Any,
    metrc_val: Any,
    severity: str,
) -> dict[str, Any]:
    return {
        "conflict_type": conflict_type,
        "field_name": field_name,
        "omma_value": str(omma_val) if omma_val is not None else None,
        "metrc_value": str(metrc_val) if metrc_val is not None else None,
        "conflict_status": "open",
        "severity": severity,
        "notes": "source_a=omma;source_b=metrc",
    }


def _operational_status(bundle: GrowerBundle, has_conflicts: bool) -> tuple[str, bool]:
    if bundle.match_type == "omma_only":
        return "omma_only", True
    if bundle.match_type == "metrc_only":
        caution = not (bundle.metrc_primary and bundle.metrc_primary.phone_normalized)
        return "metrc_only", caution
    caution = has_conflicts
    return "active_confirmed", caution


def _display_fields(bundle: GrowerBundle) -> dict[str, Any]:
    o, m = bundle.omma_row, bundle.metrc_primary
    if bundle.match_type == "matched":
        return {
            "business_name_display": (m.business_name if m else None)
            or (o.business_name if o else None),
            "dba_display": o.dba if o else None,
            "license_type_display": (m.license_type if m else None)
            or (o.license_type if o else None),
            "city_display": o.city if o else None,
            "county_display": o.county if o else None,
            "address_display": (m.address_normalized or m.address_raw) if m else None,
            "expiration_date": o.expiration_date if o else None,
        }
    if bundle.match_type == "omma_only":
        return {
            "business_name_display": o.business_name if o else None,
            "dba_display": o.dba if o else None,
            "license_type_display": o.license_type if o else None,
            "city_display": o.city if o else None,
            "county_display": o.county if o else None,
            "address_display": None,
            "expiration_date": o.expiration_date if o else None,
        }
    return {
        "business_name_display": m.business_name if m else None,
        "dba_display": None,
        "license_type_display": m.license_type if m else None,
        "city_display": None,
        "county_display": None,
        "address_display": (m.address_normalized or m.address_raw) if m else None,
        "expiration_date": None,
    }


def _clear_grower_merge(db) -> None:
    from cannacore_models import (
        Company,
        ContactPoint,
        DataConflict,
        License,
        LicenseSourceLink,
    )

    grower_ids = [
        x[0]
        for x in db.query(License.id)
        .filter(License.license_category == "grower")
        .all()
    ]
    if grower_ids:
        db.query(DataConflict).filter(DataConflict.license_id.in_(grower_ids)).delete(
            synchronize_session=False
        )
        db.query(LicenseSourceLink).filter(
            LicenseSourceLink.license_id.in_(grower_ids)
        ).delete(synchronize_session=False)
        db.query(ContactPoint).filter(ContactPoint.license_id.in_(grower_ids)).delete(
            synchronize_session=False
        )
        company_ids = [
            x[0]
            for x in db.query(License.company_id)
            .filter(License.id.in_(grower_ids), License.company_id.isnot(None))
            .all()
        ]
        db.query(License).filter(License.id.in_(grower_ids)).delete(
            synchronize_session=False
        )
        if company_ids:
            db.query(Company).filter(Company.id.in_(company_ids)).delete(
                synchronize_session=False
            )
    db.flush()


def _write_reports(
    summary: MergeSummary,
    bundles: dict[str, GrowerBundle],
    conflict_rows: list[dict[str, Any]],
) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).isoformat()

    def row_for_report(b: GrowerBundle) -> dict[str, str]:
        o, m = b.omma_row, b.metrc_primary
        return {
            "license_masked": _mask_license(b.license_norm),
            "match_type": b.match_type,
            "business_name": _norm_text(
                (m.business_name if m else None) or (o.business_name if o else "")
            )[:80],
        }

    omma_only = [row_for_report(b) for b in bundles.values() if b.match_type == "omma_only"]
    metrc_only = [row_for_report(b) for b in bundles.values() if b.match_type == "metrc_only"]
    matched = [row_for_report(b) for b in bundles.values() if b.match_type == "matched"]

    for name, rows in (
        ("omma_only_growers.csv", omma_only),
        ("metrc_only_growers.csv", metrc_only),
        ("matched_growers.csv", matched),
        ("conflicts_created.csv", conflict_rows),
    ):
        path = REPORTS_DIR / name
        if rows:
            with path.open("w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
        else:
            path.write_text("", encoding="utf-8")
        summary.reports_written.append(str(path.relative_to(REPO_ROOT)))

    payload = {
        "generated_at": generated_at,
        "dry_run": summary.dry_run,
        "omma_unique_licenses": summary.omma_unique_licenses,
        "metrc_unique_valid_licenses": summary.metrc_unique_valid_licenses,
        "matched": summary.matched,
        "omma_only": summary.omma_only,
        "metrc_only": summary.metrc_only,
        "companies_inserted": summary.companies_inserted,
        "licenses_inserted": summary.licenses_inserted,
        "contact_points_inserted": summary.contact_points_inserted,
        "source_links_inserted": summary.source_links_inserted,
        "conflicts_created": summary.conflicts_created,
        "missing_emails": summary.missing_emails,
        "missing_phones": summary.missing_phones,
    }
    json_path = REPORTS_DIR / "merge_summary.json"
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    summary.reports_written.append(str(json_path.relative_to(REPO_ROOT)))

    md = [
        "# CannaCore grower merge summary",
        "",
        f"Generated: {generated_at}",
        f"Mode: {'dry-run' if summary.dry_run else 'apply'}",
        "",
        f"- OMMA unique grower licenses: **{summary.omma_unique_licenses:,}**",
        f"- Metrc unique valid grower licenses: **{summary.metrc_unique_valid_licenses:,}**",
        f"- Matched: **{summary.matched:,}**",
        f"- OMMA-only: **{summary.omma_only:,}**",
        f"- Metrc-only: **{summary.metrc_only:,}**",
        f"- Companies inserted: **{summary.companies_inserted:,}**",
        f"- Licenses inserted: **{summary.licenses_inserted:,}**",
        f"- Contact points inserted: **{summary.contact_points_inserted:,}**",
        f"- Source links inserted: **{summary.source_links_inserted:,}**",
        f"- Conflicts created: **{summary.conflicts_created:,}**",
        f"- Missing emails: **{summary.missing_emails:,}**",
        f"- Missing phones: **{summary.missing_phones:,}**",
    ]
    md_path = REPORTS_DIR / "merge_summary.md"
    md_path.write_text("\n".join(md), encoding="utf-8")
    summary.reports_written.append(str(md_path.relative_to(REPO_ROOT)))


def _print_summary(summary: MergeSummary) -> None:
    mode = "DRY RUN" if summary.dry_run else "APPLY"
    print(f"\n=== CannaCore grower merge ({mode}) ===\n")
    print(f"OMMA unique grower licenses:     {summary.omma_unique_licenses:,}")
    print(f"Metrc unique valid licenses:     {summary.metrc_unique_valid_licenses:,}")
    print(f"Matched:                         {summary.matched:,}")
    print(f"OMMA-only:                       {summary.omma_only:,}")
    print(f"Metrc-only:                      {summary.metrc_only:,}")
    print(f"Companies inserted:              {summary.companies_inserted:,}")
    print(f"Licenses inserted:               {summary.licenses_inserted:,}")
    print(f"Contact points inserted:         {summary.contact_points_inserted:,}")
    print(f"Source links inserted:           {summary.source_links_inserted:,}")
    print(f"Conflicts created:               {summary.conflicts_created:,}")
    print(f"Missing emails:                  {summary.missing_emails:,}")
    print(f"Missing phones:                  {summary.missing_phones:,}")
    if summary.reports_written:
        print("\nReports:")
        for r in summary.reports_written:
            print(f"  - {r}")


def _apply_merge(
    db,
    bundles: dict[str, GrowerBundle],
    summary: MergeSummary,
    import_run_id: int,
) -> list[dict[str, Any]]:
    from cannacore_models import (
        Company,
        ContactPoint,
        DataConflict,
        License,
        LicenseSourceLink,
    )

    now = datetime.utcnow()
    conflict_report_rows: list[dict[str, Any]] = []

    for bundle in bundles.values():
        conflicts = _detect_conflicts(bundle)
        has_conflicts = len(conflicts) > 0
        op_status, marketing_caution = _operational_status(bundle, has_conflicts)
        fields = _display_fields(bundle)
        o, m = bundle.omma_row, bundle.metrc_primary

        display = fields["business_name_display"] or bundle.license_norm
        company = Company(
            display_name=display,
            legal_name=display,
            primary_dba=fields.get("dba_display"),
            confidence_score=1.0 if bundle.match_type == "matched" else 0.8,
        )
        db.add(company)
        db.flush()
        summary.companies_inserted += 1

        license_row = License(
            company_id=company.id,
            license_number_normalized=bundle.license_norm,
            license_number_display=bundle.license_norm,
            license_prefix=bundle.license_norm[:4] if len(bundle.license_norm) >= 4 else None,
            license_category="grower",
            business_name_display=fields["business_name_display"],
            dba_display=fields.get("dba_display"),
            license_type_display=fields.get("license_type_display"),
            city_display=fields.get("city_display"),
            county_display=fields.get("county_display"),
            state="OK",
            address_display=fields.get("address_display"),
            expiration_date=fields.get("expiration_date"),
            operational_status=op_status,
            marketing_caution=marketing_caution,
            last_seen_in_omma_at=now if o else None,
            last_seen_in_metrc_at=now if m else None,
            merge_version=1,
            merge_metadata=json.dumps(
                {
                    "match_type": bundle.match_type,
                    "merge_phase": "E",
                }
            ),
        )
        db.add(license_row)
        db.flush()
        summary.licenses_inserted += 1

        if o and o.email_normalized:
            db.add(
                ContactPoint(
                    license_id=license_row.id,
                    contact_type="email",
                    value_normalized=o.email_normalized,
                    value_display=o.email_raw,
                    is_primary=True,
                    source_system="omma",
                    source_priority=1,
                    first_seen_at=now,
                    is_active=True,
                )
            )
            summary.contact_points_inserted += 1
        else:
            summary.missing_emails += 1

        if m and m.phone_normalized:
            db.add(
                ContactPoint(
                    license_id=license_row.id,
                    contact_type="phone",
                    value_normalized=m.phone_normalized,
                    value_display=m.phone_raw,
                    is_primary=True,
                    source_system="metrc",
                    source_priority=1,
                    first_seen_at=now,
                    is_active=True,
                )
            )
            summary.contact_points_inserted += 1
        elif bundle.match_type in ("matched", "metrc_only"):
            summary.missing_phones += 1

        for omma_r in bundle.omma_rows:
            db.add(
                LicenseSourceLink(
                    license_id=license_row.id,
                    raw_omma_license_id=omma_r.id,
                    import_run_id=import_run_id,
                    link_role="primary",
                )
            )
            summary.source_links_inserted += 1

        for metrc_r in bundle.metrc_all_rows:
            primary_id = bundle.metrc_primary.id if bundle.metrc_primary else None
            if primary_id is not None and metrc_r.id == primary_id:
                role = "primary"
            else:
                cls = metrc_r.duplicate_classification or "none"
                if cls in ("exact_duplicate_row", "duplicate_metrc_license"):
                    role = "secondary_facility"
                elif cls == "duplicate_omma_license":
                    role = "secondary_facility"
                else:
                    role = "secondary_facility"
            db.add(
                LicenseSourceLink(
                    license_id=license_row.id,
                    raw_metrc_license_id=metrc_r.id,
                    import_run_id=import_run_id,
                    link_role=role,
                )
            )
            summary.source_links_inserted += 1

        for c in conflicts:
            db.add(
                DataConflict(
                    license_id=license_row.id,
                    conflict_type=c["conflict_type"],
                    field_name=c["field_name"],
                    omma_value=c["omma_value"],
                    metrc_value=c["metrc_value"],
                    conflict_status=c["conflict_status"],
                    severity=c["severity"],
                    detected_at=now,
                    notes=c.get("notes"),
                )
            )
            summary.conflicts_created += 1
            conflict_report_rows.append(
                {
                    "license_masked": _mask_license(bundle.license_norm),
                    "conflict_type": c["conflict_type"],
                    "severity": c["severity"],
                    "field_name": c["field_name"],
                }
            )

    return conflict_report_rows


def main() -> int:
    _setup_path()
    parser = argparse.ArgumentParser(description="Merge grower licenses (Phase E)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    _check_db()

    from cannacore_database import SessionLocal
    from cannacore_models import ImportRun, RawMetrcLicense, RawOmmaLicense

    db = SessionLocal()
    summary = MergeSummary(dry_run=args.dry_run)
    try:
        omma_rows, metrc_rows = _load_grower_raw_rows(db)
        omma_unique = {
            r.license_number_normalized
            for r in omma_rows
            if r.license_validation_status == "valid" and r.license_number_normalized
        }
        metrc_primary_keys = set()
        metrc_by: dict[str, list] = defaultdict(list)
        for r in metrc_rows:
            if (r.duplicate_classification or "") in EXCLUDED_FROM_ANY:
                continue
            if r.license_validation_status != "valid" or not r.license_number_normalized:
                continue
            metrc_by[r.license_number_normalized].append(r)
        for lic, rows in metrc_by.items():
            if _pick_primary_metrc(rows):
                metrc_primary_keys.add(lic)

        summary.omma_unique_licenses = len(omma_unique)
        summary.metrc_unique_valid_licenses = len(metrc_primary_keys)

        bundles = _build_bundles(omma_rows, metrc_rows)
        summary.matched = sum(1 for b in bundles.values() if b.match_type == "matched")
        summary.omma_only = sum(1 for b in bundles.values() if b.match_type == "omma_only")
        summary.metrc_only = sum(1 for b in bundles.values() if b.match_type == "metrc_only")

        conflict_rows: list[dict[str, Any]] = []
        for b in bundles.values():
            for c in _detect_conflicts(b):
                conflict_rows.append(
                    {
                        "license_masked": _mask_license(b.license_norm),
                        "conflict_type": c["conflict_type"],
                        "severity": c["severity"],
                        "field_name": c["field_name"],
                    }
                )
                if c["conflict_type"] == "missing_email":
                    summary.missing_emails += 1
                if c["conflict_type"] == "missing_phone":
                    summary.missing_phones += 1

        if not args.dry_run:
            import_run = ImportRun(
                run_type="merge",
                status="running",
                started_at=datetime.utcnow(),
            )
            db.add(import_run)
            db.commit()
            db.refresh(import_run)

            _clear_grower_merge(db)
            conflict_rows = _apply_merge(db, bundles, summary, import_run.id)
            import_run.status = "success"
            import_run.finished_at = datetime.utcnow()
            import_run.rows_processed = summary.licenses_inserted
            import_run.log_summary = json.dumps(
                {
                    "matched": summary.matched,
                    "omma_only": summary.omma_only,
                    "metrc_only": summary.metrc_only,
                }
            )
            db.commit()
        else:
            summary.companies_inserted = len(bundles)
            summary.licenses_inserted = len(bundles)
            for b in bundles.values():
                if b.omma_row and b.omma_row.email_normalized:
                    summary.contact_points_inserted += 1
                if b.metrc_primary and b.metrc_primary.phone_normalized:
                    summary.contact_points_inserted += 1
                summary.source_links_inserted += len(b.omma_rows) + len(b.metrc_all_rows)
            summary.conflicts_created = len(conflict_rows)

        _write_reports(summary, bundles, conflict_rows)
    finally:
        db.close()

    _print_summary(summary)
    if not args.dry_run:
        from sqlalchemy import func
        from cannacore_database import SessionLocal as SL
        from cannacore_models import (
            Company,
            ContactPoint,
            DataConflict,
            License,
            LicenseSourceLink,
        )

        db2 = SL()
        try:
            print("\n--- cannacore.db merged layer counts ---")
            for label, model in (
                ("companies", Company),
                ("licenses", License),
                ("contact_points", ContactPoint),
                ("license_source_links", LicenseSourceLink),
                ("data_conflicts", DataConflict),
            ):
                print(f"  {label}: {db2.query(func.count(model.id)).scalar()}")
        finally:
            db2.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
