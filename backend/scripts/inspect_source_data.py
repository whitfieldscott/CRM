#!/usr/bin/env python3
"""
Read-only profiler for CannaCore source Excel files under data/raw/omma/ and data/raw/metrc/.

Writes reports to data/reports/ only. Does not touch app.db or raw source files.

Usage (from repo root):
  python backend/scripts/inspect_source_data.py
  python backend/scripts/inspect_source_data.py --sample-rows 3
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_OMMA = REPO_ROOT / "data" / "raw" / "omma"
RAW_METRC = REPO_ROOT / "data" / "raw" / "metrc"
REPORTS_DIR = REPO_ROOT / "data" / "reports"

EXCEL_SUFFIXES = {".xlsx", ".xls", ".xlsm"}

LICENSE_HEADER_RE = re.compile(
    r"license|licence|permit|facility\s*id|facility\s*license",
    re.I,
)
EMAIL_HEADER_RE = re.compile(r"e[-_\s]?mail|email\s*address", re.I)
PHONE_HEADER_RE = re.compile(
    r"phone|mobile|cell|tel|telephone|fax",
    re.I,
)

# OMMA / Metrc license tokens: e.g. GAAI-SUR5-I7VN
LICENSE_VALUE_RE = re.compile(r"^[A-Z]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$")


def _json_default(obj: Any) -> Any:
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.isoformat()
    if pd.isna(obj):
        return None
    if hasattr(obj, "item"):
        try:
            return obj.item()
        except (ValueError, AttributeError):
            pass
    return str(obj)


def normalize_license(value: Any) -> Optional[str]:
    """Normalize license strings for cross-source matching."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    if not s or s.lower() in ("nan", "none", "null"):
        return None
    s = s.upper()
    s = s.replace("–", "-").replace("—", "-")
    s = re.sub(r"\s+", "", s)
    return s or None


def detect_columns(columns: list[str]) -> dict[str, list[str]]:
    license_cols: list[str] = []
    email_cols: list[str] = []
    phone_cols: list[str] = []
    for col in columns:
        name = str(col)
        if LICENSE_HEADER_RE.search(name):
            license_cols.append(name)
        if EMAIL_HEADER_RE.search(name):
            email_cols.append(name)
        if PHONE_HEADER_RE.search(name):
            phone_cols.append(name)
    return {
        "license_columns": license_cols,
        "email_columns": email_cols,
        "phone_columns": phone_cols,
    }


def profile_sheet(
    df: pd.DataFrame,
    *,
    sample_rows: int,
) -> dict[str, Any]:
    columns = [str(c) for c in df.columns]
    detected = detect_columns(columns)
    null_counts = {str(c): int(df[c].isna().sum()) for c in df.columns}

    duplicate_full_rows = int(df.duplicated().sum())
    duplicate_license_rows: Optional[int] = None
    license_duplicate_examples: list[str] = []
    primary_license_col: Optional[str] = None

    if detected["license_columns"]:
        primary_license_col = detected["license_columns"][0]
        lic_series = df[primary_license_col].map(normalize_license)
        dup_mask = lic_series.duplicated(keep=False) & lic_series.notna()
        duplicate_license_rows = int(dup_mask.sum())
        if dup_mask.any():
            counts = lic_series[dup_mask].value_counts()
            license_duplicate_examples = [str(k) for k in counts.head(10).index.tolist()]

    sample = df.head(sample_rows).copy()
    sample_records: list[dict[str, Any]] = []
    for _, row in sample.iterrows():
        rec: dict[str, Any] = {}
        for col in sample.columns:
            v = row[col]
            if pd.isna(v):
                rec[str(col)] = None
            elif isinstance(v, float) and v == int(v):
                rec[str(col)] = int(v)
            else:
                rec[str(col)] = v
        sample_records.append(rec)

    return {
        "row_count": int(len(df)),
        "column_count": int(len(columns)),
        "columns": columns,
        "null_counts_per_column": null_counts,
        "detected": detected,
        "primary_license_column": primary_license_col,
        "duplicate_full_rows": duplicate_full_rows,
        "duplicate_license_rows": duplicate_license_rows,
        "license_duplicate_examples": license_duplicate_examples,
        "sample_rows": sample_records,
    }


def profile_workbook(path: Path, *, sample_rows: int) -> dict[str, Any]:
    result: dict[str, Any] = {
        "path": str(path.relative_to(REPO_ROOT)),
        "filename": path.name,
        "size_bytes": path.stat().st_size,
        "sheets": {},
        "error": None,
    }
    try:
        xl = pd.ExcelFile(path, engine="openpyxl")
    except Exception as e:
        result["error"] = f"Could not open workbook: {e}"
        return result

    result["sheet_names"] = xl.sheet_names
    for sheet in xl.sheet_names:
        try:
            df = pd.read_excel(xl, sheet_name=sheet, dtype=object)
        except Exception as e:
            result["sheets"][sheet] = {"error": str(e)}
            continue
        result["sheets"][sheet] = profile_sheet(df, sample_rows=sample_rows)
    return result


def collect_excel_files() -> list[Path]:
    files: list[Path] = []
    for folder in (RAW_OMMA, RAW_METRC):
        if not folder.is_dir():
            continue
        for p in sorted(folder.iterdir()):
            if p.is_file() and p.suffix.lower() in EXCEL_SUFFIXES:
                files.append(p)
    return files


def _find_grower_workbook(files: list[Path], source: str) -> Optional[Path]:
    """Pick OMMA grower or Metrc grower file by filename heuristics."""
    candidates = [f for f in files if source in str(f.parent).lower()]
    if source == "omma":
        for f in candidates:
            if "grower" in f.name.lower():
                return f
    if source == "metrc":
        for f in candidates:
            if "grower" in f.name.lower() or "metc" in f.name.lower():
                return f
    return candidates[0] if candidates else None


def _load_primary_sheet(path: Path) -> tuple[pd.DataFrame, str]:
    xl = pd.ExcelFile(path, engine="openpyxl")
    sheet = "Data" if "Data" in xl.sheet_names else xl.sheet_names[0]
    df = pd.read_excel(xl, sheet_name=sheet, dtype=object)
    return df, sheet


def _license_series(df: pd.DataFrame) -> tuple[pd.Series, str]:
    detected = detect_columns([str(c) for c in df.columns])
    col = detected["license_columns"][0] if detected["license_columns"] else None
    if not col:
        raise ValueError("No license column detected")
    return df[col].map(normalize_license), col


def analyze_license_formatting(
    raw_values: pd.Series,
    normalized: pd.Series,
    label: str,
) -> dict[str, Any]:
    raw_str = raw_values.dropna().astype(str).str.strip()
    norm = normalized.dropna()
    norm_set = set(norm.tolist())

    non_standard: list[str] = []
    for raw in raw_str.head(5000):
        n = normalize_license(raw)
        if n and not LICENSE_VALUE_RE.match(n):
            non_standard.append(raw)
        if len(non_standard) >= 20:
            break

    lengths = Counter(len(x) for x in norm_set)
    has_space_in_raw = int(raw_str.str.contains(r"\s").sum())
    has_lower = int(raw_str.str.contains(r"[a-z]").sum())
    dash_variants = Counter(
        "-" in x or "–" in x or "—" in x for x in raw_str.head(5000)
    )

    return {
        "source": label,
        "unique_licenses": int(norm.nunique()),
        "total_rows_with_license": int(norm.notna().sum()),
        "null_or_empty_license_rows": int(normalized.isna().sum()),
        "non_standard_format_samples": non_standard[:20],
        "normalized_length_distribution": dict(sorted(lengths.items())),
        "raw_values_with_whitespace": has_space_in_raw,
        "raw_values_with_lowercase": has_lower,
        "raw_values_with_dash": int(dash_variants.get(True, 0)),
    }


def compare_omma_metrc_growers(
    omma_path: Path,
    metrc_path: Path,
) -> dict[str, Any]:
    omma_df, omma_sheet = _load_primary_sheet(omma_path)
    metrc_df, metrc_sheet = _load_primary_sheet(metrc_path)

    omma_norm, omma_lic_col = _license_series(omma_df)
    metrc_norm, metrc_lic_col = _license_series(metrc_df)

    omma_set = set(omma_norm.dropna().tolist())
    metrc_set = set(metrc_norm.dropna().tolist())
    matched = omma_set & metrc_set
    omma_only = omma_set - metrc_set
    metrc_only = metrc_set - omma_set

    return {
        "omma_file": str(omma_path.relative_to(REPO_ROOT)),
        "metrc_file": str(metrc_path.relative_to(REPO_ROOT)),
        "omma_sheet": omma_sheet,
        "metrc_sheet": metrc_sheet,
        "omma_license_column": omma_lic_col,
        "metrc_license_column": metrc_lic_col,
        "omma_unique_licenses": len(omma_set),
        "metrc_unique_licenses": len(metrc_set),
        "matching_licenses": len(matched),
        "omma_only_licenses": len(omma_only),
        "metrc_only_licenses": len(metrc_only),
        "match_rate_vs_omma_pct": round(100.0 * len(matched) / len(omma_set), 2)
        if omma_set
        else None,
        "match_rate_vs_metrc_pct": round(100.0 * len(matched) / len(metrc_set), 2)
        if metrc_set
        else None,
        "sample_matching_licenses": sorted(matched)[:25],
        "sample_omma_only_licenses": sorted(omma_only)[:25],
        "sample_metrc_only_licenses": sorted(metrc_only)[:25],
        "omma_formatting": analyze_license_formatting(
            omma_df[omma_lic_col], omma_norm, "omma_grower"
        ),
        "metrc_formatting": analyze_license_formatting(
            metrc_df[metrc_lic_col], metrc_norm, "metrc_grower"
        ),
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, default=_json_default),
        encoding="utf-8",
    )


def render_markdown_summary(
    profiles: list[dict[str, Any]],
    comparison: Optional[dict[str, Any]],
    generated_at: str,
) -> str:
    lines = [
        "# CannaCore source data inspection",
        "",
        f"Generated: {generated_at}",
        "",
        "Read-only report. Raw files and `app.db` were not modified.",
        "",
        "## Workbooks profiled",
        "",
    ]
    for p in profiles:
        lines.append(f"### `{p['filename']}`")
        if p.get("error"):
            lines.append(f"- **Error:** {p['error']}")
            lines.append("")
            continue
        lines.append(f"- Path: `{p['path']}`")
        lines.append(f"- Sheets: {', '.join(p.get('sheet_names', []))}")
        for sheet_name, sheet in p.get("sheets", {}).items():
            if sheet.get("error"):
                lines.append(f"- Sheet `{sheet_name}`: error — {sheet['error']}")
                continue
            lines.append(
                f"- Sheet `{sheet_name}`: **{sheet['row_count']:,}** rows, "
                f"{sheet['column_count']} columns"
            )
            det = sheet.get("detected", {})
            if det.get("license_columns"):
                lines.append(
                    f"  - License columns: {', '.join(det['license_columns'])}"
                )
            if det.get("email_columns"):
                lines.append(f"  - Email columns: {', '.join(det['email_columns'])}")
            if det.get("phone_columns"):
                lines.append(f"  - Phone columns: {', '.join(det['phone_columns'])}")
            lines.append(
                f"  - Duplicate full rows: {sheet.get('duplicate_full_rows', 0):,}; "
                f"duplicate license rows: {sheet.get('duplicate_license_rows')}"
            )
        lines.append("")

    if comparison:
        lines.extend(
            [
                "## OMMA grower vs Metrc grower (license match)",
                "",
                f"- OMMA: `{comparison['omma_file']}` (column `{comparison['omma_license_column']}`)",
                f"- Metrc: `{comparison['metrc_file']}` (column `{comparison['metrc_license_column']}`)",
                f"- Unique OMMA licenses: **{comparison['omma_unique_licenses']:,}**",
                f"- Unique Metrc licenses: **{comparison['metrc_unique_licenses']:,}**",
                f"- Matching: **{comparison['matching_licenses']:,}**",
                f"- OMMA only: **{comparison['omma_only_licenses']:,}**",
                f"- Metrc only: **{comparison['metrc_only_licenses']:,}**",
                f"- Match rate (vs OMMA): {comparison.get('match_rate_vs_omma_pct')}%",
                f"- Match rate (vs Metrc): {comparison.get('match_rate_vs_metrc_pct')}%",
                "",
                "See `omma_grower_vs_metrc_grower.json` for samples and formatting notes.",
                "",
            ]
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Profile Excel source files under data/raw/omma and data/raw/metrc."
    )
    parser.add_argument(
        "--sample-rows",
        type=int,
        default=5,
        help="Number of sample rows per sheet (default: 5)",
    )
    args = parser.parse_args()

    generated_at = datetime.now(timezone.utc).isoformat()
    excel_files = collect_excel_files()

    if not excel_files:
        print("No Excel files found under data/raw/omma/ or data/raw/metrc/", file=sys.stderr)
        return 1

    profiles: list[dict[str, Any]] = []
    for path in excel_files:
        print(f"Profiling {path.relative_to(REPO_ROOT)} ...")
        profile = profile_workbook(path, sample_rows=args.sample_rows)
        profiles.append(profile)
        safe_name = re.sub(r"[^\w.-]+", "_", path.stem)[:120]
        write_json(REPORTS_DIR / "per_file" / f"{safe_name}.json", profile)

    comparison: Optional[dict[str, Any]] = None
    omma_grower = _find_grower_workbook(excel_files, "omma")
    metrc_grower = _find_grower_workbook(excel_files, "metrc")
    if omma_grower and metrc_grower:
        print(
            f"Comparing growers: {omma_grower.name} vs {metrc_grower.name} ..."
        )
        try:
            comparison = compare_omma_metrc_growers(omma_grower, metrc_grower)
            write_json(
                REPORTS_DIR / "omma_grower_vs_metrc_grower.json", comparison
            )
            md_compare = [
                "# OMMA grower vs Metrc grower",
                "",
                f"Generated: {generated_at}",
                "",
                json.dumps(comparison, indent=2, default=_json_default),
            ]
            (REPORTS_DIR / "omma_grower_vs_metrc_grower.md").write_text(
                "\n".join(md_compare), encoding="utf-8"
            )
        except Exception as e:
            comparison = {"error": str(e)}
            write_json(REPORTS_DIR / "omma_grower_vs_metrc_grower.json", comparison)

    summary = {
        "generated_at": generated_at,
        "repo_root": str(REPO_ROOT),
        "source_folders": [
            str(RAW_OMMA.relative_to(REPO_ROOT)),
            str(RAW_METRC.relative_to(REPO_ROOT)),
        ],
        "files_profiled": [str(p.relative_to(REPO_ROOT)) for p in excel_files],
        "workbooks": profiles,
        "grower_comparison": comparison,
    }
    write_json(REPORTS_DIR / "inspection_summary.json", summary)
    (REPORTS_DIR / "inspection_summary.md").write_text(
        render_markdown_summary(profiles, comparison, generated_at),
        encoding="utf-8",
    )

    print(f"\nReports written to {REPORTS_DIR.relative_to(REPO_ROOT)}/")
    print(f"  - inspection_summary.json / .md")
    print(f"  - per_file/*.json ({len(profiles)} files)")
    if comparison and not comparison.get("error"):
        print("  - omma_grower_vs_metrc_grower.json / .md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
