"""Oklahoma Metrc API client (https://api-ok.metrc.com)."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)

METRC_BASE_URL = "https://api-ok.metrc.com"
# Integrator vendor key as HTTP Basic username; empty until configured.
METRC_VENDOR_KEY = os.getenv("METRC_VENDOR_KEY", "")
METRC_USER_KEY = os.getenv("METRC_USER_KEY", "")


class MetrcError(Exception):
    """Metrc HTTP or configuration error."""

    def __init__(self, status_code: int, detail: str, body: Any = None) -> None:
        self.status_code = status_code
        self.detail = detail
        self.body = body
        super().__init__(detail)


def _session() -> requests.Session:
    if not (METRC_USER_KEY or "").strip():
        raise MetrcError(
            503,
            "METRC_USER_KEY is not set. Add it to your .env file to use Metrc endpoints.",
        )
    s = requests.Session()
    s.auth = HTTPBasicAuth(METRC_VENDOR_KEY or "", METRC_USER_KEY.strip())
    s.headers.setdefault("Accept", "application/json")
    return s


def _request_json(method: str, path: str, *, params: Optional[dict[str, Any]] = None) -> Any:
    url = f"{METRC_BASE_URL}{path}"
    try:
        r = _session().request(method, url, params=params or {}, timeout=120)
    except requests.RequestException as e:
        raise MetrcError(502, f"Metrc request failed: {e}") from e

    if r.status_code >= 400:
        detail: str
        try:
            payload = r.json()
            detail = str(payload) if not isinstance(payload, dict) else (
                payload.get("Message")
                or payload.get("message")
                or payload.get("detail")
                or str(payload)
            )
        except Exception:
            detail = (r.text or r.reason or "Metrc error").strip() or "Metrc error"
        raise MetrcError(r.status_code, detail, body=r.text[:2000] if r.text else None)

    if not r.content:
        return None
    try:
        return r.json()
    except Exception as e:
        raise MetrcError(502, f"Metrc returned non-JSON: {e}") from e


def list_licenses() -> Any:
    """Facilities for the authenticated user (each includes License)."""
    return _request_json("GET", "/facilities/v2/")


def active_packages(license_number: str) -> Any:
    return _request_json(
        "GET",
        "/packages/v2/active",
        params={"licenseNumber": license_number},
    )


def transfers_incoming_outgoing(license_number: str) -> dict[str, Any]:
    incoming = _request_json(
        "GET",
        "/transfers/v2/incoming",
        params={"licenseNumber": license_number},
    )
    outgoing = _request_json(
        "GET",
        "/transfers/v2/outgoing",
        params={"licenseNumber": license_number},
    )
    return {"incoming": incoming, "outgoing": outgoing}


def plants_for_license(license_number: str) -> dict[str, Any]:
    """Vegetative, flowering, and mother plants (typical grow views)."""
    vegetative = _request_json(
        "GET",
        "/plants/v2/vegetative",
        params={"licenseNumber": license_number},
    )
    flowering = _request_json(
        "GET",
        "/plants/v2/flowering",
        params={"licenseNumber": license_number},
    )
    mother = _request_json(
        "GET",
        "/plants/v2/mother",
        params={"licenseNumber": license_number},
    )
    return {
        "vegetative": vegetative,
        "flowering": flowering,
        "mother": mother,
    }
