"""Metrc HTTP and configuration errors."""

from __future__ import annotations

from typing import Any


class MetrcError(Exception):
    def __init__(self, status_code: int, detail: str, body: Any = None) -> None:
        self.status_code = status_code
        self.detail = detail
        self.body = body
        super().__init__(detail)
