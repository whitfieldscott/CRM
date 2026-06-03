"""Low-level Metrc HTTP client with sandbox guards and request logging."""

from __future__ import annotations

import json
from typing import Any, Optional

import requests
from requests.auth import HTTPBasicAuth
from sqlalchemy.orm import Session

from metrc.config import get_metrc_settings
from metrc.errors import MetrcError
from metrc.logging_store import MetrcRequestLogger


def _ensure_sandbox(settings: Any) -> None:
    try:
        settings.validate_sandbox_only()
    except ValueError as e:
        raise MetrcError(503, str(e)) from e


def _session() -> requests.Session:
    settings = get_metrc_settings()
    _ensure_sandbox(settings)
    if not settings.user_key:
        raise MetrcError(
            503,
            "METRC_USER_KEY is not set. Add it to .env to use Metrc endpoints.",
        )
    s = requests.Session()
    s.auth = HTTPBasicAuth(settings.api_key or "", settings.user_key)
    s.headers.setdefault("Accept", "application/json")
    return s


def request_json(
    db: Session,
    method: str,
    path: str,
    *,
    params: Optional[dict[str, Any]] = None,
    json_body: Any = None,
    license_number: Optional[str] = None,
    workbook_section: Optional[str] = None,
) -> Any:
    settings = get_metrc_settings()
    _ensure_sandbox(settings)

    if not path.startswith("/"):
        path = f"/{path}"

    req_body_str: Optional[str] = None
    if json_body is not None:
        req_body_str = json.dumps(json_body)

    logger = MetrcRequestLogger(
        db,
        method=method,
        path=path,
        query=params,
        license_number=license_number or settings.default_license_number or None,
        workbook_section=workbook_section,
        request_body=req_body_str,
    )

    url = f"{settings.base_url}{path}"
    response_status: Optional[int] = None
    response_text: Optional[str] = None
    error_message: Optional[str] = None

    try:
        r = _session().request(
            method,
            url,
            params=params or {},
            json=json_body,
            timeout=settings.http_timeout_sec,
        )
        response_status = r.status_code
        response_text = r.text or ""

        if r.status_code >= 400:
            detail = _extract_error_detail(r)
            error_message = detail
            logger.finish(
                response_status=response_status,
                response_body=response_text,
                error_message=error_message,
            )
            db.commit()
            raise MetrcError(r.status_code, detail, body=response_text[:2000] or None)

        if not r.content:
            logger.finish(response_status=response_status, response_body=None)
            db.commit()
            return None

        try:
            payload = r.json()
        except Exception as e:
            error_message = f"Metrc returned non-JSON: {e}"
            logger.finish(
                response_status=response_status,
                response_body=response_text,
                error_message=error_message,
            )
            db.commit()
            raise MetrcError(502, error_message) from e

        logger.finish(
            response_status=response_status,
            response_body=response_text,
        )
        db.commit()
        return payload

    except MetrcError:
        raise
    except requests.RequestException as e:
        error_message = f"Metrc request failed: {e}"
        logger.finish(
            response_status=response_status,
            response_body=response_text,
            error_message=error_message,
        )
        db.commit()
        raise MetrcError(502, error_message) from e


def _extract_error_detail(r: requests.Response) -> str:
    try:
        payload = r.json()
        if isinstance(payload, dict):
            return (
                payload.get("Message")
                or payload.get("message")
                or payload.get("detail")
                or str(payload)
            )
        return str(payload)
    except Exception:
        return (r.text or r.reason or "Metrc error").strip() or "Metrc error"
