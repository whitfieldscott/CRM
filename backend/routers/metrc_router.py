"""Metrc BFF routes (no credentials exposed to the frontend)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from cannacore_database import get_cannacore_db
from metrc.config import get_metrc_settings
from metrc.errors import MetrcError
from metrc.facilities import sync_metrc_facilities
from metrc_models import MetrcFacility

router = APIRouter(prefix="/metrc", tags=["metrc"])


class MetrcFacilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    facility_id: Optional[int] = None
    license_number: str
    facility_name: Optional[str] = None
    display_name: Optional[str] = None
    license_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    synced_at: datetime


class MetrcFacilitiesListResponse(BaseModel):
    facilities: list[MetrcFacilityResponse]
    count: int
    sandbox: bool
    base_url_host: str
    sync_stats: Optional[dict[str, Any]] = None


def _metrc_http_exception(exc: MetrcError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.get("/facilities", response_model=MetrcFacilitiesListResponse)
def list_metrc_facilities(
    sync: bool = Query(
        False,
        description="When true, pull from Metrc sandbox and upsert metrc_facilities before returning.",
    ),
    db: Session = Depends(get_cannacore_db),
):
    settings = get_metrc_settings()
    try:
        settings.validate_sandbox_only()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    sync_stats: Optional[dict[str, Any]] = None
    if sync:
        try:
            sync_stats = sync_metrc_facilities(db)
        except MetrcError as e:
            raise _metrc_http_exception(e) from e
        except ValueError as e:
            raise HTTPException(status_code=502, detail=str(e)) from e

    rows = (
        db.query(MetrcFacility)
        .order_by(MetrcFacility.display_name, MetrcFacility.license_number)
        .all()
    )
    host = settings.base_url.split("//", 1)[-1].split("/")[0]
    return MetrcFacilitiesListResponse(
        facilities=[MetrcFacilityResponse.model_validate(r) for r in rows],
        count=len(rows),
        sandbox=settings.sandbox,
        base_url_host=host,
        sync_stats=sync_stats,
    )
