"""
Shared normalization helpers for CannaCore Phase D (no DB imports).
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Optional

import pandas as pd

LICENSE_FORMAT_RE = re.compile(r"^[A-Z]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$")
EMAIL_SYNTAX_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

WHITESPACE_RE = re.compile(r"\s+")


def normalize_license(value: Any) -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    if not s or s.lower() in ("nan", "none", "null"):
        return None
    s = s.upper().replace("–", "-").replace("—", "-")
    s = WHITESPACE_RE.sub("", s)
    return s or None


def validate_license_normalized(value: Optional[str]) -> str:
    """Return license_validation_status: valid | missing | invalid_format."""
    if not value:
        return "missing"
    if LICENSE_FORMAT_RE.match(value):
        return "valid"
    return "invalid_format"


def normalize_text(value: Any) -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    if not s or s.lower() in ("nan", "none"):
        return None
    return WHITESPACE_RE.sub(" ", s)


def normalize_email(value: Any) -> tuple[Optional[str], str]:
    """Return (normalized_email, email_validation_status)."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None, "missing"
    s = str(value).strip().lower()
    if not s or s in ("nan", "none"):
        return None, "missing"
    s = WHITESPACE_RE.sub("", s)
    if EMAIL_SYNTAX_RE.match(s):
        return s, "valid"
    return s, "invalid"


def coerce_phone_input(value: Any) -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, float):
        if pd.isna(value):
            return None
        if value == int(value):
            return str(int(value))
    s = str(value).strip()
    if not s or s.lower() in ("nan", "none"):
        return None
    if "e+" in s.lower() or "e-" in s.lower():
        try:
            return str(int(float(s)))
        except (ValueError, OverflowError):
            pass
    return s


def normalize_phone_us(value: Any) -> tuple[Optional[str], str]:
    """Return (e164_or_none, phone_validation_status)."""
    raw = coerce_phone_input(value)
    if raw is None:
        return None, "missing"
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:
        return f"+1{digits}", "valid"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}", "valid"
    return None, "invalid"


def mask_email(email: Optional[str]) -> str:
    if not email or "@" not in email:
        return ""
    local, _, domain = email.partition("@")
    show = (local[0] + "***") if local else "***"
    return f"{show}@{domain}"


def mask_phone(phone: Optional[str]) -> str:
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if len(digits) < 4:
        return "***"
    return f"***-***-{digits[-4:]}"


def row_fingerprint(
    *,
    license_norm: Optional[str],
    business_name: Optional[str],
    extra: Optional[str] = None,
) -> str:
    payload = "|".join(
        [
            license_norm or "",
            (business_name or "").upper(),
            extra or "",
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def raw_json_fingerprint(raw_json: Optional[str]) -> Optional[str]:
    if not raw_json:
        return None
    try:
        data = json.loads(raw_json)
        canonical = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    except (json.JSONDecodeError, TypeError):
        return hashlib.sha256(raw_json.encode("utf-8")).hexdigest()
