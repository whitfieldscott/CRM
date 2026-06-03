"""
Legacy Metrc module — delegates to backend.metrc foundation layer.

Prefer: metrc.client, metrc.facilities, routers.metrc_router
"""

from __future__ import annotations

from typing import Any, Optional

from metrc.config import get_metrc_settings
from metrc.errors import MetrcError

# Backward-compatible aliases (METRC_VENDOR_KEY → use METRC_API_KEY in config).
METRC_BASE_URL = get_metrc_settings().base_url
METRC_VENDOR_KEY = get_metrc_settings().api_key
METRC_USER_KEY = get_metrc_settings().user_key


def list_licenses() -> Any:
    """Deprecated: use get_facilities_v2(db) with a cannacore session."""
    raise MetrcError(
        501,
        "list_licenses() requires a database session. Use GET /metrc/facilities?sync=true.",
    )


def active_packages(license_number: str) -> Any:
    raise MetrcError(501, "Not implemented in Metrc foundation build.")


def transfers_incoming_outgoing(license_number: str) -> dict[str, Any]:
    raise MetrcError(501, "Not implemented in Metrc foundation build.")


def plants_for_license(license_number: str) -> dict[str, Any]:
    raise MetrcError(501, "Not implemented in Metrc foundation build.")
