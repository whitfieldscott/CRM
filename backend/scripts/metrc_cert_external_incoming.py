#!/usr/bin/env python3
"""
Metrc Certification — Transfer External Incoming workflow (Oklahoma sandbox).

Runs POST → GET incoming → GET delivery packages → PUT (optional) and writes
evidence JSON + markdown under docs/certification/.

Usage (repo root):
  python backend/scripts/metrc_cert_external_incoming.py
  python backend/scripts/metrc_cert_external_incoming.py --skip-create
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
DOCS_DIR = REPO_ROOT / "docs" / "certification"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from cannacore_database import SessionLocal  # noqa: E402
from metrc.client import request_json  # noqa: E402
from metrc.errors import MetrcError  # noqa: E402
from metrc.sync_utils import extract_metrc_list, resolve_license_number  # noqa: E402
from metrc_models import MetrcApiRequestLog  # noqa: E402

TRANSFER_TYPE = "Seeds Only External Inventory Transfer"
ITEM_NAME = "Clone"


def _ts(offset_hours: int = 0) -> str:
    return (datetime.utcnow() + timedelta(hours=offset_hours)).strftime(
        "%Y-%m-%dT%H:%M:%S.000"
    )


def _ensure_item_exists(db, license_number: str) -> dict[str, Any]:
    items = request_json(
        db,
        "GET",
        "/items/v2/active",
        params={"licenseNumber": license_number},
        license_number=license_number,
        workbook_section="cert_prereq_items",
    )
    rows = extract_metrc_list(items, context="items")
    for row in rows:
        if isinstance(row, dict) and (row.get("Name") or row.get("name")) == ITEM_NAME:
            return {"status": "exists", "item": row}
    return {"status": "missing", "item": None}


def _build_post_body(license_number: str, *, invoice: str, quantity: float) -> list[dict[str, Any]]:
    return [
        {
            "ShipperLicenseNumber": "EXT-SHIPPER-CERT-001",
            "ShipperName": "External Shipper Certification",
            "ShipperMainPhoneNumber": "4055550100",
            "ShipperAddress1": "100 Test St",
            "ShipperAddress2": None,
            "ShipperAddressCity": "Oklahoma City",
            "ShipperAddressState": "OK",
            "ShipperAddressPostalCode": "73101",
            "TransporterFacilityLicenseNumber": None,
            "DriverOccupationalLicenseNumber": None,
            "DriverName": None,
            "DriverLicenseNumber": None,
            "PhoneNumberForQuestions": None,
            "VehicleMake": None,
            "VehicleModel": None,
            "VehicleLicensePlateNumber": None,
            "VehicleRegistrationNumber": None,
            "Destinations": [
                {
                    "RecipientLicenseNumber": license_number,
                    "InvoiceNumber": invoice,
                    "TransferTypeName": TRANSFER_TYPE,
                    "PlannedRoute": "Certification external incoming test route.",
                    "EstimatedDepartureDateTime": _ts(1),
                    "EstimatedArrivalDateTime": _ts(3),
                    "GrossWeight": None,
                    "GrossUnitOfWeightId": None,
                    "Transporters": [],
                    "Packages": [
                        {
                            "ItemName": ITEM_NAME,
                            "Quantity": quantity,
                            "UnitOfMeasureName": "Each",
                            "PackagedDate": _ts(0),
                            "ExpirationDate": None,
                            "SellByDate": None,
                            "UseByDate": None,
                            "GrossWeight": None,
                            "GrossUnitOfWeightName": None,
                            "WholesalePrice": None,
                            "ExternalId": None,
                            "IsFinishedGood": False,
                        }
                    ],
                }
            ],
        }
    ]


def _step(
    evidence: dict[str, Any],
    name: str,
    fn,
) -> Any:
    step: dict[str, Any] = {"step": name, "started_at": datetime.utcnow().isoformat() + "Z"}
    evidence["steps"].append(step)
    try:
        result = fn()
        step["status"] = "success"
        step["result"] = result
        return result
    except MetrcError as e:
        step["status"] = "error"
        step["http_status"] = e.status_code
        step["error"] = e.detail
        step["body"] = e.body
        raise
    except Exception as e:
        step["status"] = "error"
        step["error"] = str(e)
        raise
    finally:
        step["finished_at"] = datetime.utcnow().isoformat() + "Z"


def run(*, skip_create: bool) -> int:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    evidence: dict[str, Any] = {
        "workflow": "transfers_v2_external_incoming",
        "state": "OK",
        "sandbox_host": "sandbox-api-ok.metrc.com",
        "started_at": datetime.utcnow().isoformat() + "Z",
        "steps": [],
    }

    try:
        license_number = resolve_license_number(None)
        evidence["license_number"] = license_number

        prereq = _step(
            evidence,
            "prerequisite_item_clone",
            lambda: _ensure_item_exists(db, license_number),
        )
        evidence["prerequisite"] = prereq
        if prereq.get("status") == "missing":
            evidence["blocked"] = (
                f'Item "{ITEM_NAME}" must exist. Run seed_metrc_sandbox_master_data.py first.'
            )
            _write_outputs(evidence, db)
            print(evidence["blocked"], file=sys.stderr)
            return 1

        post_body = _build_post_body(
            license_number, invoice="INV-CERT-EXT-002", quantity=10.0
        )
        evidence["post_request_body"] = post_body

        transfer_id: int | None = None
        if not skip_create:
            post_resp = _step(
                evidence,
                "POST /transfers/v2/external/incoming",
                lambda: request_json(
                    db,
                    "POST",
                    "/transfers/v2/external/incoming",
                    params={"licenseNumber": license_number},
                    json_body=post_body,
                    license_number=license_number,
                    workbook_section="external_incoming_post",
                ),
            )
            evidence["post_response"] = post_resp
            ids = (post_resp or {}).get("Ids") or []
            transfer_id = int(ids[0]) if ids else None
            evidence["transfer_id"] = transfer_id
            evidence["result_codes"] = {
                "post": "Ids returned" if transfer_id else "no Id",
                "warnings": (post_resp or {}).get("Warnings"),
            }
        else:
            incoming_probe = request_json(
                db,
                "GET",
                "/transfers/v2/incoming",
                params={"licenseNumber": license_number},
                license_number=license_number,
                workbook_section="external_incoming_get",
            )
            rows = extract_metrc_list(incoming_probe, context="incoming")
            if rows and isinstance(rows[0], dict):
                transfer_id = int(rows[0].get("Id") or 0) or None
                evidence["transfer_id"] = transfer_id

        if not transfer_id:
            evidence["blocked"] = "No transfer Id available for verification steps."
            _write_outputs(evidence, db)
            return 1

        incoming = _step(
            evidence,
            "GET /transfers/v2/incoming",
            lambda: request_json(
                db,
                "GET",
                "/transfers/v2/incoming",
                params={"licenseNumber": license_number},
                license_number=license_number,
                workbook_section="external_incoming_get",
            ),
        )
        incoming_rows = extract_metrc_list(incoming, context="incoming")
        evidence["incoming_response_sample"] = incoming_rows[:1]
        match = next(
            (r for r in incoming_rows if isinstance(r, dict) and r.get("Id") == transfer_id),
            None,
        )
        if match:
            evidence["facility_ids"] = {
                "transfer_id": match.get("Id"),
                "delivery_id": match.get("DeliveryId"),
                "recipient_facility_license": match.get("RecipientFacilityLicenseNumber"),
                "manifest_number": match.get("ManifestNumber"),
            }
            evidence["last_modified"] = match.get("LastModified")
            evidence["created_date_time"] = match.get("CreatedDateTime")

        packages = _step(
            evidence,
            f"GET /transfers/v2/deliveries/{transfer_id}/packages",
            lambda: request_json(
                db,
                "GET",
                f"/transfers/v2/deliveries/{transfer_id}/packages",
                params={"licenseNumber": license_number},
                license_number=license_number,
                workbook_section="external_incoming_packages",
            ),
        )
        pkg_rows = extract_metrc_list(packages, context="delivery_packages")
        evidence["delivery_packages"] = pkg_rows
        if pkg_rows and isinstance(pkg_rows[0], dict):
            evidence["package_ids"] = {
                "package_id": pkg_rows[0].get("PackageId"),
                "item_id": pkg_rows[0].get("ItemId"),
                "item_name": pkg_rows[0].get("ItemName"),
                "package_label": pkg_rows[0].get("PackageLabel"),
            }

        put_body = [
            {
                "TransferId": transfer_id,
                **post_body[0],
                "Destinations": [
                    {
                        **post_body[0]["Destinations"][0],
                        "TransferDestinationId": transfer_id,
                        "InvoiceNumber": "INV-CERT-EXT-002-PUT",
                        "Packages": [
                            {
                                **post_body[0]["Destinations"][0]["Packages"][0],
                                "Quantity": 11.0,
                            }
                        ],
                    }
                ],
            }
        ]
        evidence["put_request_body"] = put_body
        try:
            _step(
                evidence,
                "PUT /transfers/v2/external/incoming",
                lambda: request_json(
                    db,
                    "PUT",
                    "/transfers/v2/external/incoming",
                    params={"licenseNumber": license_number},
                    json_body=put_body,
                    license_number=license_number,
                    workbook_section="external_incoming_put",
                ),
            )
            evidence["put_result"] = "success"
        except MetrcError as e:
            evidence["put_result"] = "failed"
            evidence["put_error"] = {"status": e.status_code, "detail": e.detail, "body": e.body}
            evidence["put_note"] = (
                "OK sandbox may require Transporters on PUT even when POST allowed empty array."
            )

        evidence["status"] = "completed"
        evidence["finished_at"] = datetime.utcnow().isoformat() + "Z"
        _write_outputs(evidence, db)
        print(f"Certification evidence written to {DOCS_DIR}")
        print(f"Transfer Id: {transfer_id}")
        return 0
    except Exception:
        evidence["status"] = "failed"
        evidence["finished_at"] = datetime.utcnow().isoformat() + "Z"
        _write_outputs(evidence, db)
        raise
    finally:
        db.close()


def _write_outputs(evidence: dict[str, Any], db) -> None:
    json_path = DOCS_DIR / "external_incoming_transfer_evidence.json"
    json_path.write_text(json.dumps(evidence, indent=2, default=str), encoding="utf-8")

    logs = (
        db.query(MetrcApiRequestLog)
        .filter(
            MetrcApiRequestLog.workbook_section.in_(
                [
                    "external_incoming_post",
                    "external_incoming_get",
                    "external_incoming_put",
                    "external_incoming_packages",
                    "cert_prereq_items",
                ]
            )
        )
        .order_by(MetrcApiRequestLog.id.desc())
        .limit(20)
        .all()
    )
    log_rows = [
        {
            "id": r.id,
            "correlation_id": r.correlation_id,
            "workbook_section": r.workbook_section,
            "http_method": r.http_method,
            "path": r.path,
            "response_status": r.response_status,
            "duration_ms": r.duration_ms,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in logs
    ]
    (DOCS_DIR / "external_incoming_request_logs.json").write_text(
        json.dumps(log_rows, indent=2), encoding="utf-8"
    )

    md = _render_markdown(evidence, log_rows)
    (DOCS_DIR / "PHASE_2_2_EXTERNAL_INCOMING_TRANSFER.md").write_text(md, encoding="utf-8")


def _render_markdown(evidence: dict[str, Any], log_rows: list[dict[str, Any]]) -> str:
    lines = [
        "# Phase 2.2 — Metrc External Incoming Transfer Certification",
        "",
        f"**License:** `{evidence.get('license_number', '')}`  ",
        f"**Status:** `{evidence.get('status', 'unknown')}`  ",
        f"**Transfer type:** `{TRANSFER_TYPE}`  ",
        "",
        "## Workbook steps captured",
        "",
        "| Step | Endpoint | Notes |",
        "|------|----------|-------|",
    ]
    for step in evidence.get("steps", []):
        status = step.get("status", "")
        name = step.get("step", "")
        note = ""
        if step.get("error"):
            note = str(step.get("error"))[:120]
        lines.append(f"| {name} | {status} | {note} |")

    lines.extend(
        [
            "",
            "## Result codes",
            "",
            f"```json\n{json.dumps(evidence.get('result_codes', evidence.get('post_response')), indent=2, default=str)}\n```",
            "",
            "## Facility / transfer IDs",
            "",
            f"```json\n{json.dumps(evidence.get('facility_ids', {}), indent=2, default=str)}\n```",
            "",
            "## Package IDs",
            "",
            f"```json\n{json.dumps(evidence.get('package_ids', {}), indent=2, default=str)}\n```",
            "",
            "## LastModified",
            "",
            f"`{evidence.get('last_modified', 'n/a')}`",
            "",
            "## Required fields (POST body)",
            "",
            "- ShipperLicenseNumber, ShipperName, Shipper address fields",
            "- Destinations[].RecipientLicenseNumber, TransferTypeName, PlannedRoute",
            "- Destinations[].EstimatedDepartureDateTime, EstimatedArrivalDateTime",
            "- Destinations[].Packages[].ItemName, Quantity, UnitOfMeasureName, PackagedDate",
            f"- Item `{ITEM_NAME}` must exist on facility before POST",
            "- ExternalId disabled on OK sandbox recipient (omit or null)",
            "",
            "## PUT note",
            "",
            evidence.get(
                "put_note",
                "See put_error in evidence JSON if PUT was attempted.",
            ),
            "",
            "## Request logs (DB)",
            "",
            f"```json\n{json.dumps(log_rows, indent=2)}\n```",
            "",
            "## Screenshots",
            "",
            "Capture Metrc Connect / Postman UI screenshots manually for workbook submission.",
            "API evidence is in `external_incoming_transfer_evidence.json`.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--skip-create",
        action="store_true",
        help="Skip POST; verify existing incoming transfer only.",
    )
    args = parser.parse_args()
    return run(skip_create=args.skip_create)


if __name__ == "__main__":
    raise SystemExit(main())
