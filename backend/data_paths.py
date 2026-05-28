"""Safe resolution of CSV files under the repo data/ directory."""

from pathlib import Path

from fastapi import HTTPException

REPO_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def safe_data_csv_file_name(name: str) -> str:
    """Validate a CSV basename (no path traversal, .csv only)."""
    n = (name or "").strip()
    if not n:
        raise HTTPException(status_code=400, detail="file_name is required")
    if ".." in n or "/" in n or "\\" in n:
        raise HTTPException(status_code=400, detail="Invalid file_name")
    if Path(n).is_absolute():
        raise HTTPException(status_code=400, detail="Invalid file_name")
    base = Path(n).name
    if base != n:
        raise HTTPException(status_code=400, detail="Invalid file_name")
    if not base.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are allowed")
    return base


def resolve_data_csv_path(file_name: str) -> Path:
    """Return resolved path under data/; 400 on bad name, 404 if missing."""
    safe = safe_data_csv_file_name(file_name)
    data_dir = REPO_DATA_DIR.resolve()
    candidate = (data_dir / safe).resolve()
    try:
        candidate.relative_to(data_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file_name") from None
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="CSV file not found")
    return candidate
