#!/usr/bin/env python3
"""
Phase D — normalize raw OMMA/Metrc rows in backend/cannacore.db only.

No merge, no app.db changes, raw_json untouched.

Prerequisite:
  python backend/scripts/upgrade_cannacore_phase_d_schema.py

Usage:
  python backend/scripts/normalize_raw_licenses.py --dry-run
  python backend/scripts/normalize_raw_licenses.py
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
REPORTS_DIR = REPO_ROOT / "data" / "reports" / "normalization"

REQUIRED_OMMA_COLS = frozenset(
    {
        "license_validation_status",
        "email_validation_status",
        "duplicate_classification",
        "normalization_status",
        "normalized_at",
    }
)
REQUIRED_METRC_COLS = frozenset(
    {
        "license_validation_status",
        "phone_validation_status",
        "duplicate_classification",
        "normalization_status",
        "normalized_at",
    }
)


def _setup_path() -> None:
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))


def _check_db() -> None:
    from cannacore_database import CANNACORE_DB_PATH

    if not CANNACORE_DB_PATH.is_file():
        print(
            "Error: backend/cannacore.db not found.\n"
            "Run: python backend/scripts/create_cannacore_db.py",
            file=sys.stderr,
        )
        raise SystemExit(1)


def _schema_ready() -> bool:
    from sqlalchemy import inspect

    from cannacore_database import engine

    insp = inspect(engine)
    omma = {c["name"] for c in insp.get_columns("raw_omma_licenses")}
    metrc = {c["name"] for c in insp.get_columns("raw_metrc_licenses")}
    missing_omma = REQUIRED_OMMA_COLS - omma
    missing_metrc = REQUIRED_METRC_COLS - metrc
    if missing_omma or missing_metrc:
        print("Schema missing Phase D normalization columns.", file=sys.stderr)
        if missing_omma:
            print(f"  raw_omma_licenses: {sorted(missing_omma)}", file=sys.stderr)
        if missing_metrc:
            print(f"  raw_metrc_licenses: {sorted(missing_metrc)}", file=sys.stderr)
        print(
            "\nRun: python backend/scripts/upgrade_cannacore_phase_d_schema.py",
            file=sys.stderr,
        )
        return False
    return True


@dataclass
class RowResult:
    source: str  # omma | metrc
    id: int
    source_file_id: int
    row_number: int
    license_number_raw: Optional[str]
    license_number_normalized: Optional[str]
    license_validation_status: str
    email_validation_status: Optional[str] = None
    phone_validation_status: Optional[str] = None
    duplicate_classification: str = "none"
    business_name: Optional[str] = None
    email_masked: str = ""
    phone_masked: str = ""
    raw_json_hash: Optional[str] = None


@dataclass
class NormalizationSummary:
    dry_run: bool = False
    omma_scanned: int = 0
    metrc_scanned: int = 0
    rows_updated: int = 0
    invalid_licenses: int = 0
    missing_licenses: int = 0
    duplicate_license_rows: int = 0
    exact_duplicate_rows: int = 0
    possible_facility_duplicates: int = 0
    invalid_emails: int = 0
    invalid_phones: int = 0
    reports_written: list[str] = field(default_factory=list)


def _classify_duplicates(
    rows: list[RowResult],
    *,
    source: str,
) -> None:
    """Set duplicate_classification on rows (in place) per source_file_id."""
    dup_label = (
        "duplicate_omma_license" if source == "omma" else "duplicate_metrc_license"
    )
    by_file: dict[int, list[RowResult]] = defaultdict(list)
    for r in rows:
        by_file[r.source_file_id].append(r)

    for file_rows in by_file.values():
        json_groups: dict[str, list[RowResult]] = defaultdict(list)
        lic_groups: dict[str, list[RowResult]] = defaultdict(list)

        for r in file_rows:
            if r.license_validation_status == "missing":
                r.duplicate_classification = "missing_license_quarantine"
                continue
            if r.raw_json_hash:
                json_groups[r.raw_json_hash].append(r)
            if r.license_validation_status == "valid" and r.license_number_normalized:
                lic_groups[r.license_number_normalized].append(r)

        for group in json_groups.values():
            if len(group) > 1:
                for r in group:
                    if r.duplicate_classification == "none":
                        r.duplicate_classification = "exact_duplicate_row"

        for _lic, group in lic_groups.items():
            if len(group) < 2:
                continue
            names = {(r.business_name or "").upper() for r in group}
            if len(names) > 1:
                for r in group:
                    if r.duplicate_classification in ("none", dup_label):
                        r.duplicate_classification = "possible_facility_duplicate"
            else:
                for r in group:
                    if r.duplicate_classification == "none":
                        r.duplicate_classification = dup_label


def _process_omma_row(row) -> RowResult:
    from cannacore_normalize import (
        mask_email,
        normalize_email,
        normalize_license,
        normalize_text,
        raw_json_fingerprint,
        validate_license_normalized,
    )

    lic_norm = normalize_license(row.license_number_raw or row.license_number_normalized)
    lic_status = validate_license_normalized(lic_norm)
    email_norm, email_status = normalize_email(row.email_raw or row.email_normalized)

    return RowResult(
        source="omma",
        id=row.id,
        source_file_id=row.source_file_id,
        row_number=row.row_number,
        license_number_raw=row.license_number_raw,
        license_number_normalized=lic_norm,
        license_validation_status=lic_status,
        email_validation_status=email_status,
        business_name=normalize_text(row.business_name),
        email_masked=mask_email(email_norm),
        raw_json_hash=raw_json_fingerprint(row.raw_json),
    )


def _process_metrc_row(row) -> RowResult:
    from cannacore_normalize import (
        mask_phone,
        normalize_license,
        normalize_phone_us,
        normalize_text,
        raw_json_fingerprint,
        validate_license_normalized,
    )

    lic_norm = normalize_license(row.license_number_raw or row.license_number_normalized)
    lic_status = validate_license_normalized(lic_norm)
    phone_norm, phone_status = normalize_phone_us(row.phone_raw or row.phone_normalized)

    return RowResult(
        source="metrc",
        id=row.id,
        source_file_id=row.source_file_id,
        row_number=row.row_number,
        license_number_raw=row.license_number_raw,
        license_number_normalized=lic_norm,
        license_validation_status=lic_status,
        phone_validation_status=phone_status,
        business_name=normalize_text(row.business_name),
        phone_masked=mask_phone(phone_norm),
        raw_json_hash=raw_json_fingerprint(row.raw_json),
    )


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def _build_report_rows(
    omma_results: list[RowResult],
    metrc_results: list[RowResult],
) -> dict[str, list[dict[str, Any]]]:
    invalid_license: list[dict[str, Any]] = []
    missing_license: list[dict[str, Any]] = []
    duplicate_license: list[dict[str, Any]] = []
    invalid_email: list[dict[str, Any]] = []
    invalid_phone: list[dict[str, Any]] = []

    def base(r: RowResult) -> dict[str, Any]:
        return {
            "source": r.source,
            "id": r.id,
            "source_file_id": r.source_file_id,
            "row_number": r.row_number,
            "license_number_masked": (r.license_number_normalized or "")[:4] + "***"
            if r.license_number_normalized
            else "",
            "duplicate_classification": r.duplicate_classification,
        }

    for r in omma_results + metrc_results:
        b = base(r)
        if r.license_validation_status == "invalid_format":
            invalid_license.append(
                {**b, "license_validation_status": r.license_validation_status}
            )
        if r.license_validation_status == "missing":
            missing_license.append(
                {**b, "license_validation_status": r.license_validation_status}
            )
        if r.duplicate_classification not in ("none", "missing_license_quarantine"):
            duplicate_license.append(
                {
                    **b,
                    "license_number_normalized": r.license_number_normalized or "",
                    "business_name": r.business_name or "",
                }
            )
        if r.email_validation_status == "invalid":
            invalid_email.append({**b, "email_masked": r.email_masked})
        if r.phone_validation_status == "invalid":
            invalid_phone.append({**b, "phone_masked": r.phone_masked})

    return {
        "invalid_license_rows.csv": invalid_license,
        "missing_license_rows.csv": missing_license,
        "duplicate_license_rows.csv": duplicate_license,
        "invalid_email_rows.csv": invalid_email,
        "invalid_phone_rows.csv": invalid_phone,
    }


def _write_reports(
    summary: NormalizationSummary,
    omma_results: list[RowResult],
    metrc_results: list[RowResult],
) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).isoformat()

    csv_map = _build_report_rows(omma_results, metrc_results)
    fieldnames = {
        "invalid_license_rows.csv": [
            "source",
            "id",
            "source_file_id",
            "row_number",
            "license_number_masked",
            "license_validation_status",
            "duplicate_classification",
        ],
        "missing_license_rows.csv": [
            "source",
            "id",
            "source_file_id",
            "row_number",
            "license_number_masked",
            "license_validation_status",
            "duplicate_classification",
        ],
        "duplicate_license_rows.csv": [
            "source",
            "id",
            "source_file_id",
            "row_number",
            "license_number_normalized",
            "business_name",
            "duplicate_classification",
        ],
        "invalid_email_rows.csv": [
            "source",
            "id",
            "source_file_id",
            "row_number",
            "email_masked",
            "duplicate_classification",
        ],
        "invalid_phone_rows.csv": [
            "source",
            "id",
            "source_file_id",
            "row_number",
            "phone_masked",
            "duplicate_classification",
        ],
    }

    for filename, rows in csv_map.items():
        path = REPORTS_DIR / filename
        _write_csv(path, fieldnames[filename], rows)
        summary.reports_written.append(str(path.relative_to(REPO_ROOT)))

    payload = {
        "generated_at": generated_at,
        "dry_run": summary.dry_run,
        "omma_scanned": summary.omma_scanned,
        "metrc_scanned": summary.metrc_scanned,
        "rows_updated": summary.rows_updated,
        "invalid_licenses": summary.invalid_licenses,
        "missing_licenses": summary.missing_licenses,
        "duplicate_license_rows": summary.duplicate_license_rows,
        "exact_duplicate_rows": summary.exact_duplicate_rows,
        "possible_facility_duplicates": summary.possible_facility_duplicates,
        "invalid_emails": summary.invalid_emails,
        "invalid_phones": summary.invalid_phones,
        "reports": summary.reports_written,
    }
    json_path = REPORTS_DIR / "normalization_summary.json"
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    summary.reports_written.append(str(json_path.relative_to(REPO_ROOT)))

    md_lines = [
        "# CannaCore normalization summary",
        "",
        f"Generated: {generated_at}",
        f"Mode: {'dry-run' if summary.dry_run else 'apply'}",
        "",
        "## Counts",
        "",
        f"- OMMA rows scanned: **{summary.omma_scanned:,}**",
        f"- Metrc rows scanned: **{summary.metrc_scanned:,}**",
        f"- Rows updated: **{summary.rows_updated:,}**",
        f"- Invalid licenses: **{summary.invalid_licenses:,}**",
        f"- Missing licenses: **{summary.missing_licenses:,}**",
        f"- Duplicate license rows: **{summary.duplicate_license_rows:,}**",
        f"- Exact duplicate rows: **{summary.exact_duplicate_rows:,}**",
        f"- Possible facility duplicates: **{summary.possible_facility_duplicates:,}**",
        f"- Invalid emails: **{summary.invalid_emails:,}**",
        f"- Invalid phones: **{summary.invalid_phones:,}**",
        "",
        "## Reports",
        "",
    ]
    for r in summary.reports_written:
        md_lines.append(f"- `{r}`")
    md_path = REPORTS_DIR / "normalization_summary.md"
    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    summary.reports_written.append(str(md_path.relative_to(REPO_ROOT)))


def _aggregate_stats(
    summary: NormalizationSummary,
    omma_results: list[RowResult],
    metrc_results: list[RowResult],
) -> None:
    summary.omma_scanned = len(omma_results)
    summary.metrc_scanned = len(metrc_results)
    for r in omma_results + metrc_results:
        if r.license_validation_status == "invalid_format":
            summary.invalid_licenses += 1
        if r.license_validation_status == "missing":
            summary.missing_licenses += 1
        if r.email_validation_status == "invalid":
            summary.invalid_emails += 1
        if r.phone_validation_status == "invalid":
            summary.invalid_phones += 1
        if r.duplicate_classification in (
            "duplicate_omma_license",
            "duplicate_metrc_license",
            "exact_duplicate_row",
            "possible_facility_duplicate",
        ):
            summary.duplicate_license_rows += 1
        if r.duplicate_classification == "exact_duplicate_row":
            summary.exact_duplicate_rows += 1
        if r.duplicate_classification == "possible_facility_duplicate":
            summary.possible_facility_duplicates += 1


def _apply_omma_updates(row, result: RowResult, now: datetime) -> int:
    from cannacore_normalize import normalize_email, normalize_text

    email_norm, email_status = normalize_email(row.email_raw or row.email_normalized)
    row.license_number_normalized = result.license_number_normalized
    row.license_validation_status = result.license_validation_status
    row.email_normalized = email_norm
    row.email_validation_status = email_status
    row.duplicate_classification = result.duplicate_classification
    row.normalization_status = "complete"
    row.normalized_at = now
    row.business_name = normalize_text(row.business_name)
    row.dba = normalize_text(row.dba)
    row.license_type = normalize_text(row.license_type)
    row.city = normalize_text(row.city)
    row.county = normalize_text(row.county)
    return 1


def _apply_metrc_updates(row, result: RowResult, now: datetime) -> int:
    from cannacore_normalize import normalize_phone_us, normalize_text

    phone_norm, phone_status = normalize_phone_us(row.phone_raw or row.phone_normalized)
    row.license_number_normalized = result.license_number_normalized
    row.license_validation_status = result.license_validation_status
    row.phone_normalized = phone_norm
    row.phone_validation_status = phone_status
    row.duplicate_classification = result.duplicate_classification
    row.normalization_status = "complete"
    row.normalized_at = now
    row.business_name = normalize_text(row.business_name)
    row.license_type = normalize_text(row.license_type)
    row.address_normalized = normalize_text(row.address_raw or row.address_normalized)
    return 1


def _print_console(summary: NormalizationSummary) -> None:
    mode = "DRY RUN" if summary.dry_run else "APPLY"
    print(f"\n=== CannaCore normalization ({mode}) ===\n")
    print(f"OMMA scanned:              {summary.omma_scanned:,}")
    print(f"Metrc scanned:             {summary.metrc_scanned:,}")
    print(f"Rows updated:              {summary.rows_updated:,}")
    print(f"Invalid licenses:          {summary.invalid_licenses:,}")
    print(f"Missing licenses:          {summary.missing_licenses:,}")
    print(f"Duplicate license rows:    {summary.duplicate_license_rows:,}")
    print(f"Exact duplicate rows:      {summary.exact_duplicate_rows:,}")
    print(f"Possible facility dupes:   {summary.possible_facility_duplicates:,}")
    print(f"Invalid emails:            {summary.invalid_emails:,}")
    print(f"Invalid phones:            {summary.invalid_phones:,}")
    if summary.reports_written:
        print("\nReports:")
        for r in summary.reports_written:
            print(f"  - {r}")


def main() -> int:
    _setup_path()
    parser = argparse.ArgumentParser(description="Normalize raw CannaCore license rows")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scan and report; do not update cannacore.db",
    )
    args = parser.parse_args()

    _check_db()
    if not args.dry_run and not _schema_ready():
        return 1
    if args.dry_run and not _schema_ready():
        print(
            "Note: schema columns missing; dry-run will scan only (no DB status fields).",
        )

    from cannacore_database import SessionLocal
    from cannacore_models import RawMetrcLicense, RawOmmaLicense

    db = SessionLocal()
    summary = NormalizationSummary(dry_run=args.dry_run)
    try:
        omma_rows = db.query(RawOmmaLicense).order_by(
            RawOmmaLicense.source_file_id, RawOmmaLicense.row_number
        ).all()
        metrc_rows = db.query(RawMetrcLicense).order_by(
            RawMetrcLicense.source_file_id, RawMetrcLicense.row_number
        ).all()

        omma_results = [_process_omma_row(r) for r in omma_rows]
        metrc_results = [_process_metrc_row(r) for r in metrc_rows]

        _classify_duplicates(omma_results, source="omma")
        _classify_duplicates(metrc_results, source="metrc")
        _aggregate_stats(summary, omma_results, metrc_results)

        if not args.dry_run:
            if not _schema_ready():
                return 1
            now = datetime.utcnow()
            for row, result in zip(omma_rows, omma_results):
                summary.rows_updated += _apply_omma_updates(row, result, now)
            for row, result in zip(metrc_rows, metrc_results):
                summary.rows_updated += _apply_metrc_updates(row, result, now)
            db.commit()

        _write_reports(summary, omma_results, metrc_results)
    finally:
        db.close()

    _print_console(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
