"""
Phase 0 — optional admin API key for sensitive routes (not wired by default).

Phase 1 TODO: attach ``require_admin_api_key`` to:
  - POST /send-bulk
  - POST /campaigns/send
  - GET /settings, PUT /settings
  - DELETE /unsubscribe
  - POST /sms/send
  - GET /test-email

Usage when enabled:
  1. Set ADMIN_API_KEY in .env (long random value).
  2. Send header: X-Admin-API-Key: <same value>

When ADMIN_API_KEY is unset, dependency is a no-op so local dev keeps working.
"""

import os

from fastapi import Header, HTTPException

ADMIN_API_KEY = (os.getenv("ADMIN_API_KEY") or "").strip()


def require_admin_api_key(
    x_admin_api_key: str | None = Header(default=None, alias="X-Admin-API-Key"),
) -> None:
    if not ADMIN_API_KEY:
        return
    if not x_admin_api_key or x_admin_api_key != ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Admin API key required")
