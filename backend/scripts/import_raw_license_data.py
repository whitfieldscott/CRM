#!/usr/bin/env python3
"""
Phase C — import raw OMMA/Metrc Excel rows into backend/cannacore.db only.

No merge, dedupe, or app.db changes.

Usage (from repo root):
  python backend/scripts/create_cannacore_db.py   # first time
  python backend/scripts/import_raw_license_data.py --dry-run
  python backend/scripts/import_raw_license_data.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
RAW_OMMA = REPO_ROOT / "data" / "raw" / "omma"
RAW_METRC = REPO_ROOT / "data" / "raw" / "metrc"

EXCEL_SUFFIXES = {".xlsx", ".xls", ".xlsm"}

LICENSE_COL_NAMES = frozenset(
    {"license no.", "license no", "license number", "license_number"}
)
EMAIL_COL_NAMES = frozenset({"email", "e-mail"})
PHONE_COL_NAMES = frozenset({"phone number", "phone", "phone_number"})

FILENAME_CATEGORY_RULES = (
    ("dispensary", "dispensary"),
    ("processor", "processor"),
    ("grower", "grower"),
    ("transporter", "transporter"),
)

PREFIX_CATEGORY = {
    "GAAA": "grower",
    "PAAA": "processor",
    "DAAA": "dispensary",
    "TAAA": "transporter",
}


def _ensure_cannacore_db_exists() -> Path:
    from cannacore_database import CANNACORE_DB_PATH

    if not CANNACORE_DB_PATH.is_file():
        print(
            "Error: backend/cannacore.db not found.\n"
            "Run first: python backend/scripts/create_cannacore_db.py",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return CANNACORE_DB_PATH


def normalize_license(value: Any) -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    if not s or s.lower() in ("nan", "none", "null"):
        return None
    s = s.upper().replace("–", "-").replace("—", "-")
    s = re.sub(r"\s+", "", s)
    return s or None


def normalize_email(value: Any) -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip().lower()
    if not s or s in ("nan", "none") or "@" not in s:
        return None
    return s


def coerce_cell_str(value: Any) -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    s = str(value).strip()
    return s if s and s.lower() not in ("nan", "none") else None


def coerce_phone_raw(value: Any) -> Optional[str]:
    s = coerce_cell_str(value)
    if s is None:
        return None
    if "e+" in s.lower() or "e-" in s.lower():
        try:
            return str(int(float(s)))
        except (ValueError, OverflowError):
            pass
    return s


def mask_email(email: Optional[str]) -> str:
    if not email or "@" not in email:
        return "(none)"
    local, _, domain = email.partition("@")
    if len(local) <= 1:
        show = "*"
    else:
        show = local[0] + "***"
    return f"{show}@{domain}"


def mask_phone(phone: Optional[str]) -> str:
    if not phone:
        return "(none)"
    digits = re.sub(r"\D", "", phone)
    if len(digits) < 4:
        return "***"
    return f"***-***-{digits[-4:]}"


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def detect_category_from_filename(name: str) -> Optional[str]:
    lower = name.lower()
    for token, category in FILENAME_CATEGORY_RULES:
        if token in lower:
            return category
    return None


def detect_category_from_license(license_norm: Optional[str]) -> Optional[str]:
    if not license_norm or len(license_norm) < 4:
        return None
    return PREFIX_CATEGORY.get(license_norm[:4].upper())


def parse_source_effective_date(filename: str) -> Optional[date]:
    m = re.search(r"(\d{2})-(\d{2})-(\d{4})", filename)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(y, mo, d)
        except ValueError:
            pass
    return None


def pick_sheet_name(xl: pd.ExcelFile, source_system: str) -> str:
    if source_system == "omma" and "Data" in xl.sheet_names:
        return "Data"
    return xl.sheet_names[0]


def column_map(columns: list[str]) -> dict[str, str]:
    """Map normalized header -> original column name."""
    out: dict[str, str] = {}
    for c in columns:
        key = str(c).strip().lower()
        out[key] = str(c)
    return out


def get_row_val(row: pd.Series, cols: dict[str, str], *candidates: str) -> Any:
    for name in candidates:
        key = name.lower()
        if key in cols:
            return row.get(cols[key])
    return None


def row_to_json(record: dict[str, Any]) -> str:
    clean: dict[str, Any] = {}
    for k, v in record.items():
        if pd.isna(v):
            clean[k] = None
        elif isinstance(v, (pd.Timestamp, datetime)):
            clean[k] = v.isoformat()
        elif isinstance(v, float) and v == int(v):
            clean[k] = int(v)
        else:
            clean[k] = v
    return json.dumps(clean, default=str)


def parse_expiration(value: Any) -> tuple[Optional[str], Optional[date]]:
    raw = coerce_cell_str(value)
    if raw is None:
        return None, None
    try:
        ts = pd.to_datetime(value, errors="coerce")
        if pd.isna(ts):
            return raw, None
        return raw, ts.date()
    except Exception:
        return raw, None


@dataclass
class FileStats:
    path: Path
    source_system: str
    license_category: str
    sheet_name: str = ""
    file_sha256: str = ""
    rows_in_file: int = 0
    rows_inserted: int = 0
    rows_skipped: int = 0
    missing_license: int = 0
    duplicate_license_rows: int = 0
    unique_duplicate_licenses: int = 0
    file_skipped: bool = False
    skip_reason: str = ""
    error: str = ""


@dataclass
class RunSummary:
    dry_run: bool = False
    files: list[FileStats] = field(default_factory=list)
    omma_rows: int = 0
    metrc_rows: int = 0
    rows_inserted: int = 0
    rows_skipped: int = 0

    def add_file(self, fs: FileStats) -> None:
        self.files.append(fs)
        if fs.source_system == "omma":
            self.omma_rows += fs.rows_in_file
        else:
            self.metrc_rows += fs.rows_in_file
        self.rows_inserted += fs.rows_inserted
        self.rows_skipped += fs.rows_skipped


def collect_excel_files() -> list[tuple[Path, str]]:
    out: list[tuple[Path, str]] = []
    for folder, system in ((RAW_OMMA, "omma"), (RAW_METRC, "metrc")):
        if not folder.is_dir():
            continue
        for p in sorted(folder.iterdir()):
            if p.is_file() and p.suffix.lower() in EXCEL_SUFFIXES:
                out.append((p, system))
    return out


def license_duplicate_stats(normalized: list[Optional[str]]) -> tuple[int, int]:
    """Return (rows_in_duplicate_groups, count_of_licenses_with_dupes)."""
    valid = [x for x in normalized if x]
    counts = Counter(valid)
    dup_licenses = {k for k, v in counts.items() if v > 1}
    dup_rows = sum(1 for x in valid if x in dup_licenses)
    return dup_rows, len(dup_licenses)


def process_file(
    path: Path,
    source_system: str,
    *,
    dry_run: bool,
    import_run_id: Optional[int] = None,
    db=None,
) -> FileStats:
    rel = path.relative_to(REPO_ROOT)
    category = detect_category_from_filename(path.name) or "unknown"
    stats = FileStats(
        path=path,
        source_system=source_system,
        license_category=category,
        file_sha256=file_sha256(path),
    )

    try:
        xl = pd.ExcelFile(path, engine="openpyxl")
        sheet = pick_sheet_name(xl, source_system)
        stats.sheet_name = sheet
        df = pd.read_excel(xl, sheet_name=sheet, dtype=object)
    except Exception as e:
        stats.error = str(e)
        return stats

    stats.rows_in_file = len(df)
    cols = column_map(list(df.columns))

    lic_col = next(
        (cols[k] for k in cols if k in LICENSE_COL_NAMES or k.startswith("license")),
        None,
    )
    if lic_col is None:
        for k, orig in cols.items():
            if "license" in k and "type" not in k:
                lic_col = orig
                break

    normalized_licenses: list[Optional[str]] = []
    for _, row in df.iterrows():
        lic_raw = row.get(lic_col) if lic_col else None
        lic_norm = normalize_license(lic_raw)
        normalized_licenses.append(lic_norm)
        if lic_norm is None:
            stats.missing_license += 1

    dup_rows, dup_keys = license_duplicate_stats(normalized_licenses)
    stats.duplicate_license_rows = dup_rows
    stats.unique_duplicate_licenses = dup_keys

    if category == "unknown" and normalized_licenses:
        for lic in normalized_licenses:
            inferred = detect_category_from_license(lic)
            if inferred:
                stats.license_category = inferred
                break

    if dry_run:
        stats.rows_inserted = stats.rows_in_file
        return stats

    from cannacore_models import RawMetrcLicense, RawOmmaLicense, SourceFile

    assert db is not None and import_run_id is not None
    try:
        existing = (
            db.query(SourceFile)
            .filter(SourceFile.file_sha256 == stats.file_sha256)
            .first()
        )
        if existing:
            stats.file_skipped = True
            stats.skip_reason = "already_imported_sha256"
            stats.rows_skipped = stats.rows_in_file
            return stats

        source_file = SourceFile(
            source_system=source_system,
            license_category=stats.license_category,
            file_path=str(rel).replace("\\", "/"),
            file_name=path.name,
            file_sha256=stats.file_sha256,
            file_size_bytes=path.stat().st_size,
            sheet_name=sheet,
            row_count=len(df),
            source_effective_date=parse_source_effective_date(path.name),
            imported_at=datetime.utcnow(),
        )
        db.add(source_file)
        db.flush()

        inserted = 0
        skipped = 0

        for row_number, (_, row) in enumerate(df.iterrows(), start=1):
            payload = {str(k): row[k] for k in df.columns}
            lic_raw = coerce_cell_str(get_row_val(row, cols, "license no.", "license number"))
            lic_norm = normalize_license(lic_raw)

            if source_system == "omma":
                exp_val = get_row_val(row, cols, "expiration")
                exp_raw, exp_date = parse_expiration(exp_val)
                email_val = get_row_val(row, cols, "email", "e-mail")

                record = RawOmmaLicense(
                    source_file_id=source_file.id,
                    import_run_id=import_run_id,
                    row_number=row_number,
                    license_number_raw=lic_raw,
                    license_number_normalized=lic_norm,
                    business_name=coerce_cell_str(
                        get_row_val(row, cols, "business name")
                    ),
                    dba=coerce_cell_str(get_row_val(row, cols, "dba")),
                    license_type=coerce_cell_str(
                        get_row_val(row, cols, "license type")
                    ),
                    city=coerce_cell_str(get_row_val(row, cols, "city")),
                    county=coerce_cell_str(get_row_val(row, cols, "county")),
                    expiration_raw=exp_raw,
                    expiration_date=exp_date,
                    email_raw=coerce_cell_str(email_val),
                    email_normalized=normalize_email(email_val),
                    raw_json=row_to_json(payload),
                )
            else:
                phone_val = get_row_val(row, cols, "phone number", "phone")
                record = RawMetrcLicense(
                    source_file_id=source_file.id,
                    import_run_id=import_run_id,
                    row_number=row_number,
                    license_number_raw=lic_raw,
                    license_number_normalized=lic_norm,
                    business_name=coerce_cell_str(
                        get_row_val(row, cols, "business name")
                    ),
                    license_type=coerce_cell_str(
                        get_row_val(row, cols, "license type")
                    ),
                    address_raw=coerce_cell_str(get_row_val(row, cols, "address")),
                    phone_raw=coerce_phone_raw(phone_val),
                    raw_json=row_to_json(payload),
                )

            db.add(record)
            inserted += 1

        stats.rows_inserted = inserted
        stats.rows_skipped = skipped
        db.commit()
    except Exception as e:
        db.rollback()
        stats.error = str(e)

    return stats


def print_summary(summary: RunSummary) -> None:
    mode = "DRY RUN" if summary.dry_run else "IMPORT"
    print(f"\n=== CannaCore raw import ({mode}) ===\n")
    for fs in summary.files:
        rel = fs.path.relative_to(REPO_ROOT)
        print(f"File: {rel}")
        print(f"  System: {fs.source_system} | Category: {fs.license_category} | Sheet: {fs.sheet_name}")
        if fs.error:
            print(f"  ERROR: {fs.error}")
            continue
        if fs.file_skipped:
            print(f"  Skipped file ({fs.skip_reason}) — rows skipped: {fs.rows_skipped}")
            continue
        print(f"  Rows in file: {fs.rows_in_file}")
        print(f"  Rows inserted: {fs.rows_inserted} | Rows skipped: {fs.rows_skipped}")
        print(f"  Missing license: {fs.missing_license}")
        print(
            f"  Duplicate license rows: {fs.duplicate_license_rows} "
            f"({fs.unique_duplicate_licenses} licenses with duplicates)"
        )
    print("\n--- Totals ---")
    print(f"Files processed: {len(summary.files)}")
    print(f"OMMA rows (in files): {summary.omma_rows}")
    print(f"Metrc rows (in files): {summary.metrc_rows}")
    print(f"Rows inserted: {summary.rows_inserted}")
    print(f"Rows skipped: {summary.rows_skipped}")
    missing = sum(f.missing_license for f in summary.files)
    dup_rows = sum(f.duplicate_license_rows for f in summary.files)
    print(f"Missing license (all files): {missing}")
    print(f"Duplicate license rows (all files): {dup_rows}")


def print_table_counts() -> None:
    from sqlalchemy import func

    from cannacore_database import SessionLocal
    from cannacore_models import (
        ImportRun,
        RawMetrcLicense,
        RawOmmaLicense,
        SourceFile,
    )

    db = SessionLocal()
    try:
        print("\n--- cannacore.db row counts ---")
        for label, model in (
            ("source_files", SourceFile),
            ("import_runs", ImportRun),
            ("raw_omma_licenses", RawOmmaLicense),
            ("raw_metrc_licenses", RawMetrcLicense),
        ):
            n = db.query(func.count(model.id)).scalar()
            print(f"  {label}: {n}")
    finally:
        db.close()


def main() -> int:
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))

    parser = argparse.ArgumentParser(description="Import raw OMMA/Metrc Excel into cannacore.db")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate files and print summary without writing to the database",
    )
    args = parser.parse_args()

    files = collect_excel_files()
    if not files:
        print("No Excel files found under data/raw/omma/ or data/raw/metrc/", file=sys.stderr)
        return 1

    if not args.dry_run:
        _ensure_cannacore_db_exists()

    summary = RunSummary(dry_run=args.dry_run)

    if args.dry_run:
        for path, system in files:
            print(f"Processing {path.relative_to(REPO_ROOT)} ...")
            summary.add_file(process_file(path, system, dry_run=True))
    else:
        from cannacore_database import SessionLocal
        from cannacore_models import ImportRun

        db = SessionLocal()
        import_run = ImportRun(
            run_type="raw_import",
            status="running",
            started_at=datetime.utcnow(),
        )
        db.add(import_run)
        db.commit()
        db.refresh(import_run)

        run_log: list[dict[str, Any]] = []
        try:
            for path, system in files:
                print(f"Processing {path.relative_to(REPO_ROOT)} ...")
                fs = process_file(
                    path,
                    system,
                    dry_run=False,
                    import_run_id=import_run.id,
                    db=db,
                )
                summary.add_file(fs)
                run_log.append(
                    {
                        "file": path.name,
                        "inserted": fs.rows_inserted,
                        "skipped": fs.rows_skipped,
                        "file_skipped": fs.file_skipped,
                        "error": fs.error or None,
                    }
                )
            import_run.status = "success"
            import_run.finished_at = datetime.utcnow()
            import_run.rows_processed = summary.rows_inserted
            import_run.rows_error = sum(1 for f in summary.files if f.error)
            import_run.log_summary = json.dumps(run_log)
            db.commit()
        except Exception as e:
            db.rollback()
            import_run.status = "failed"
            import_run.finished_at = datetime.utcnow()
            import_run.log_summary = json.dumps({"error": str(e), "files": run_log})
            db.commit()
            print(f"Fatal error: {e}", file=sys.stderr)
            db.close()
            return 1
        finally:
            db.close()

    print_summary(summary)

    if not args.dry_run:
        print_table_counts()

    return 0 if not any(f.error for f in summary.files) else 1


if __name__ == "__main__":
    raise SystemExit(main())
