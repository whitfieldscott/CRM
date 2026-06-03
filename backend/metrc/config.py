"""Metrc environment configuration (sandbox-first)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(dotenv_path=_REPO_ROOT / ".env", override=True)

_DEFAULT_SANDBOX_URL = "https://sandbox-api-ok.metrc.com"
_SANDBOX_URL_MARKER = "sandbox"


def _env_bool(name: str, default: bool = False) -> bool:
    raw = (os.getenv(name) or "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


def _env_str(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


@dataclass(frozen=True)
class MetrcSettings:
    api_key: str
    user_key: str
    base_url: str
    state: str
    sandbox: bool
    default_license_number: str
    request_logging: bool
    log_body_max_bytes: int
    http_timeout_sec: int

    @property
    def is_configured(self) -> bool:
        return bool(self.user_key)

    def validate_sandbox_only(self) -> None:
        """Reject non-sandbox hosts when sandbox mode is required."""
        if not self.sandbox:
            raise ValueError(
                "METRC_SANDBOX must be true for this build (sandbox-only foundation)."
            )
        base = self.base_url.lower()
        if _SANDBOX_URL_MARKER not in base:
            raise ValueError(
                f"METRC_BASE_URL must point at a sandbox host (expected '{_SANDBOX_URL_MARKER}' in URL)."
            )


@lru_cache
def get_metrc_settings() -> MetrcSettings:
    # METRC_API_KEY is the integrator/vendor key (Basic username).
    # METRC_VENDOR_KEY is supported as a legacy alias.
    api_key = _env_str("METRC_API_KEY") or _env_str("METRC_VENDOR_KEY")
    base_url = _env_str("METRC_BASE_URL", _DEFAULT_SANDBOX_URL).rstrip("/")
    return MetrcSettings(
        api_key=api_key,
        user_key=_env_str("METRC_USER_KEY"),
        base_url=base_url,
        state=_env_str("METRC_STATE", "OK"),
        sandbox=_env_bool("METRC_SANDBOX", default=True),
        default_license_number=_env_str("METRC_LICENSE_NUMBER"),
        request_logging=_env_bool("METRC_REQUEST_LOGGING", default=True),
        log_body_max_bytes=int(_env_str("METRC_LOG_BODY_MAX_BYTES", "65536") or "65536"),
        http_timeout_sec=int(_env_str("METRC_HTTP_TIMEOUT_SEC", "120") or "120"),
    )
