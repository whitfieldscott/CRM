"""Metrc BFF routes (no credentials exposed to the frontend)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Callable, Optional, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from cannacore_database import get_cannacore_db
from metrc.config import get_metrc_settings
from metrc.errors import MetrcError
from metrc.facilities import sync_metrc_facilities
from metrc.items import sync_metrc_items
from metrc.locations import sync_metrc_locations
from metrc.reference import get_item_categories, get_location_types, get_units_of_measure_active
from metrc.strains import sync_metrc_strains
from metrc.sync_utils import resolve_license_number
from metrc_models import MetrcFacility, MetrcItem, MetrcLocation, MetrcStrain

router = APIRouter(prefix="/metrc", tags=["metrc"])

ModelT = TypeVar("ModelT")


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


class MetrcLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    metrc_id: int
    license_number: str
    name: Optional[str] = None
    location_type_id: Optional[int] = None
    location_type_name: Optional[str] = None
    is_active: bool
    synced_at: datetime


class MetrcStrainResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    metrc_id: int
    license_number: str
    name: Optional[str] = None
    testing_status: Optional[str] = None
    thc_level: Optional[float] = None
    cbd_level: Optional[float] = None
    indica_percentage: Optional[float] = None
    sativa_percentage: Optional[float] = None
    is_active: bool
    synced_at: datetime


class MetrcItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    metrc_id: int
    license_number: str
    name: Optional[str] = None
    product_category_name: Optional[str] = None
    product_category_type: Optional[str] = None
    quantity_type: Optional[str] = None
    unit_of_measure_name: Optional[str] = None
    default_lab_testing_state: Optional[str] = None
    is_active: bool
    synced_at: datetime


class MetrcMasterDataListResponse(BaseModel):
    license_number: Optional[str] = None
    count: int
    sandbox: bool
    base_url_host: str
    sync_stats: Optional[dict[str, Any]] = None


class MetrcLocationsListResponse(MetrcMasterDataListResponse):
    locations: list[MetrcLocationResponse]


class MetrcStrainsListResponse(MetrcMasterDataListResponse):
    strains: list[MetrcStrainResponse]


class MetrcItemsListResponse(MetrcMasterDataListResponse):
    items: list[MetrcItemResponse]


class MetrcReferenceResponse(BaseModel):
    data: Any
    sandbox: bool
    base_url_host: str


def _metrc_http_exception(exc: MetrcError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


def _validate_sandbox_settings() -> Any:
    settings = get_metrc_settings()
    try:
        settings.validate_sandbox_only()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return settings


def _base_url_host(settings: Any) -> str:
    return settings.base_url.split("//", 1)[-1].split("/")[0]


def _run_sync(
    sync_fn: Callable[..., dict[str, Any]],
    db: Session,
    *,
    license_number: Optional[str],
    include_inactive: bool,
) -> dict[str, Any]:
    try:
        return sync_fn(
            db,
            license_number=license_number,
            include_inactive=include_inactive,
        )
    except MetrcError as e:
        raise _metrc_http_exception(e) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _list_master_data(
    db: Session,
    model: type[ModelT],
    response_model: type[BaseModel],
    list_response_cls: type[BaseModel],
    list_key: str,
    *,
    license_number: Optional[str],
    sync: bool,
    include_inactive: bool,
    sync_fn: Callable[..., dict[str, Any]],
    order_by: tuple[Any, ...],
) -> BaseModel:
    settings = _validate_sandbox_settings()

    sync_stats: Optional[dict[str, Any]] = None
    resolved_license: Optional[str] = None

    if sync or license_number or get_metrc_settings().default_license_number:
        try:
            resolved_license = resolve_license_number(license_number)
        except ValueError as e:
            if sync:
                raise HTTPException(status_code=400, detail=str(e)) from e

    if sync:
        sync_stats = _run_sync(
            sync_fn,
            db,
            license_number=license_number,
            include_inactive=include_inactive,
        )
        resolved_license = sync_stats.get("license_number") or resolved_license

    query = db.query(model)
    if resolved_license:
        query = query.filter(model.license_number == resolved_license)  # type: ignore[attr-defined]
    if not include_inactive:
        query = query.filter(model.is_active.is_(True))  # type: ignore[attr-defined]

    rows = query.order_by(*order_by).all()
    payload = {
        list_key: [response_model.model_validate(r) for r in rows],
        "count": len(rows),
        "license_number": resolved_license,
        "sandbox": settings.sandbox,
        "base_url_host": _base_url_host(settings),
        "sync_stats": sync_stats,
    }
    return list_response_cls(**payload)


@router.get("/facilities", response_model=MetrcFacilitiesListResponse)
def list_metrc_facilities(
    sync: bool = Query(
        False,
        description="When true, pull from Metrc sandbox and upsert metrc_facilities before returning.",
    ),
    db: Session = Depends(get_cannacore_db),
):
    settings = _validate_sandbox_settings()

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
    return MetrcFacilitiesListResponse(
        facilities=[MetrcFacilityResponse.model_validate(r) for r in rows],
        count=len(rows),
        sandbox=settings.sandbox,
        base_url_host=_base_url_host(settings),
        sync_stats=sync_stats,
    )


@router.get("/locations", response_model=MetrcLocationsListResponse)
def list_metrc_locations(
    license: Optional[str] = Query(None, description="Facility license number"),
    sync: bool = Query(False, description="Sync from Metrc before returning cached rows."),
    include_inactive: bool = Query(False, description="Include inactive Metrc rows."),
    db: Session = Depends(get_cannacore_db),
):
    return _list_master_data(
        db,
        MetrcLocation,
        MetrcLocationResponse,
        MetrcLocationsListResponse,
        "locations",
        license_number=license,
        sync=sync,
        include_inactive=include_inactive,
        sync_fn=sync_metrc_locations,
        order_by=(MetrcLocation.name, MetrcLocation.metrc_id),
    )


@router.get("/strains", response_model=MetrcStrainsListResponse)
def list_metrc_strains(
    license: Optional[str] = Query(None, description="Facility license number"),
    sync: bool = Query(False, description="Sync from Metrc before returning cached rows."),
    include_inactive: bool = Query(False, description="Include inactive Metrc rows."),
    db: Session = Depends(get_cannacore_db),
):
    return _list_master_data(
        db,
        MetrcStrain,
        MetrcStrainResponse,
        MetrcStrainsListResponse,
        "strains",
        license_number=license,
        sync=sync,
        include_inactive=include_inactive,
        sync_fn=sync_metrc_strains,
        order_by=(MetrcStrain.name, MetrcStrain.metrc_id),
    )


@router.get("/items", response_model=MetrcItemsListResponse)
def list_metrc_items(
    license: Optional[str] = Query(None, description="Facility license number"),
    sync: bool = Query(False, description="Sync from Metrc before returning cached rows."),
    include_inactive: bool = Query(False, description="Include inactive Metrc rows."),
    db: Session = Depends(get_cannacore_db),
):
    return _list_master_data(
        db,
        MetrcItem,
        MetrcItemResponse,
        MetrcItemsListResponse,
        "items",
        license_number=license,
        sync=sync,
        include_inactive=include_inactive,
        sync_fn=sync_metrc_items,
        order_by=(MetrcItem.name, MetrcItem.metrc_id),
    )


@router.get("/reference/location-types", response_model=MetrcReferenceResponse)
def metrc_location_types(
    license: Optional[str] = Query(None, description="Facility license number"),
    db: Session = Depends(get_cannacore_db),
):
    settings = _validate_sandbox_settings()
    try:
        data = get_location_types(db, license_number=license)
    except MetrcError as e:
        raise _metrc_http_exception(e) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return MetrcReferenceResponse(
        data=data,
        sandbox=settings.sandbox,
        base_url_host=_base_url_host(settings),
    )


@router.get("/reference/item-categories", response_model=MetrcReferenceResponse)
def metrc_item_categories(
    license: Optional[str] = Query(None, description="Facility license number"),
    db: Session = Depends(get_cannacore_db),
):
    settings = _validate_sandbox_settings()
    try:
        data = get_item_categories(db, license_number=license)
    except MetrcError as e:
        raise _metrc_http_exception(e) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return MetrcReferenceResponse(
        data=data,
        sandbox=settings.sandbox,
        base_url_host=_base_url_host(settings),
    )


@router.get("/reference/units-of-measure", response_model=MetrcReferenceResponse)
def metrc_units_of_measure(db: Session = Depends(get_cannacore_db)):
    settings = _validate_sandbox_settings()
    try:
        data = get_units_of_measure_active(db)
    except MetrcError as e:
        raise _metrc_http_exception(e) from e
    return MetrcReferenceResponse(
        data=data,
        sandbox=settings.sandbox,
        base_url_host=_base_url_host(settings),
    )
