"""Persist Metrc HTTP request/response logs to cannacore.db."""

from __future__ import annotations

import json
import time
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from metrc.config import get_metrc_settings
from metrc_models import MetrcApiRequestLog


def _truncate(text: Optional[str], max_bytes: int) -> Optional[str]:
    if text is None:
        return None
    encoded = text.encode("utf-8", errors="replace")
    if len(encoded) <= max_bytes:
        return text
    return encoded[:max_bytes].decode("utf-8", errors="replace") + "…[truncated]"


def log_metrc_request(
    db: Session,
    *,
    method: str,
    path: str,
    query_string: Optional[str] = None,
    license_number: Optional[str] = None,
    workbook_section: Optional[str] = None,
    request_body: Optional[str] = None,
    response_status: Optional[int] = None,
    response_body: Optional[str] = None,
    duration_ms: Optional[int] = None,
    error_message: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Optional[int]:
    settings = get_metrc_settings()
    if not settings.request_logging:
        return None

    max_b = settings.log_body_max_bytes
    row = MetrcApiRequestLog(
        correlation_id=correlation_id or str(uuid.uuid4()),
        workbook_section=workbook_section,
        http_method=method.upper(),
        path=path,
        query_string=query_string,
        license_number=license_number,
        request_body=_truncate(request_body, max_b),
        response_status=response_status,
        response_body=_truncate(response_body, max_b),
        duration_ms=duration_ms,
        error_message=error_message,
        environment="sandbox" if settings.sandbox else "production",
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.flush()
    return row.id


class MetrcRequestLogger:
    """Context helper to record one outbound Metrc HTTP call."""

    def __init__(
        self,
        db: Session,
        *,
        method: str,
        path: str,
        query: Optional[dict[str, Any]] = None,
        license_number: Optional[str] = None,
        workbook_section: Optional[str] = None,
        request_body: Optional[str] = None,
    ) -> None:
        self.db = db
        self.method = method
        self.path = path
        self.query_string = json.dumps(query, sort_keys=True) if query else None
        self.license_number = license_number
        self.workbook_section = workbook_section
        self.request_body = request_body
        self._started = time.perf_counter()
        self.correlation_id = str(uuid.uuid4())

    def finish(
        self,
        *,
        response_status: Optional[int] = None,
        response_body: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> None:
        duration_ms = int((time.perf_counter() - self._started) * 1000)
        log_metrc_request(
            self.db,
            method=self.method,
            path=self.path,
            query_string=self.query_string,
            license_number=self.license_number,
            workbook_section=self.workbook_section,
            request_body=self.request_body,
            response_status=response_status,
            response_body=response_body,
            duration_ms=duration_ms,
            error_message=error_message,
            correlation_id=self.correlation_id,
        )
