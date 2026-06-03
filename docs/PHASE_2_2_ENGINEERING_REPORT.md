# Phase 2.2 Engineering Report — Metrc Certification & Sandbox Foundation

**Project:** CannaCore (ArkOne Systems)  
**Date:** 2026-06-03  
**Status:** Phase 2.2 **substantially complete** — see exit checklist for remaining manual items.

---

## 1. What was completed

### Metrc backend foundation (prior + this continuation)

- Sandbox-only HTTP client with request/response logging to `metrc_api_request_logs`
- Facility sync: `GET /facilities/v2/` → `metrc_facilities` (11 OK sandbox facilities verified)
- Master data sync: locations, strains, items + reference passthrough routes
- Environment: `METRC_API_KEY`, `METRC_USER_KEY`, `METRC_BASE_URL`, `METRC_STATE`, `METRC_SANDBOX`, `METRC_LICENSE_NUMBER`

### Metrc Certification — External Incoming Transfer (Step 1)

- Executed `POST /transfers/v2/external/incoming` on Oklahoma sandbox
- Transfer type: **Seeds Only External Inventory Transfer**
- Successful **Transfer Id: 5801**, manifest `0000005801`
- Verified via `GET /transfers/v2/incoming` and `GET /transfers/v2/deliveries/5801/packages`
- Evidence artifacts:
  - `docs/certification/PHASE_2_2_EXTERNAL_INCOMING_TRANSFER.md`
  - `docs/certification/external_incoming_transfer_evidence.json`
  - `docs/certification/external_incoming_request_logs.json`
- Script: `backend/scripts/metrc_cert_external_incoming.py`
- **PUT** update attempted; sandbox returned `Transporters not specified` (documented — POST/GET sufficient for workbook with note)

### Sandbox master data (Step 4)

- Script: `backend/scripts/seed_metrc_sandbox_master_data.py`
- Default license `SF-SBX-OK-3-8701` (Medical Grower):
  - **10 locations** (Mother Room, Clone Room, Veg A/B, Flower A/B, Dry, Trim, Vault, Quarantine)
  - **10 strains** (Blue Dream through White Truffle)
  - **10 items** (Clone through Fresh Frozen; Shake uses OK category `Shake/Trim bulk`)
- Cache tables synced after seeding

### Seed-To-Sale frontend (Steps 2–3)

- Facility provider + **facility selector** bar on all `/metrc/*` routes
- Live `GET /metrc/facilities?sync=true` on load
- License persistence via `localStorage` (`cannacore_metrc_license`)
- Facility dashboard at `/metrc/[license]` using cached facility rows (not legacy `/metrc/licenses`)
- Master data tabs: Locations, Strains, Items, Reference (location types, item categories, UoM)

---

## 2. Files created

| Path |
|------|
| `backend/metrc/sync_utils.py` |
| `backend/metrc/locations.py` |
| `backend/metrc/strains.py` |
| `backend/metrc/items.py` |
| `backend/metrc/reference.py` |
| `backend/scripts/upgrade_cannacore_metrc_master_data_schema.py` |
| `backend/scripts/metrc_cert_external_incoming.py` |
| `backend/scripts/seed_metrc_sandbox_master_data.py` |
| `docs/certification/PHASE_2_2_EXTERNAL_INCOMING_TRANSFER.md` |
| `docs/certification/external_incoming_transfer_evidence.json` |
| `docs/certification/external_incoming_request_logs.json` |
| `web/types/metrc.ts` |
| `web/lib/metrc-storage.ts` |
| `web/components/metrc/metrc-facility-context.tsx` |
| `web/components/metrc/facility-bar.tsx` |
| `web/components/metrc/master-data-panel.tsx` |
| `web/app/metrc/layout.tsx` |
| `docs/PHASE_2_2_ENGINEERING_REPORT.md` |

## 3. Files modified

| Path |
|------|
| `backend/metrc_models.py` |
| `backend/routers/metrc_router.py` |
| `backend/metrc/__init__.py` |
| `web/app/metrc/page.tsx` |
| `web/app/metrc/[license]/page.tsx` |
| `.env.example` (from foundation; verify locally) |

---

## 4. Routes verified

| Method | Route | Result |
|--------|-------|--------|
| GET | `/metrc/facilities?sync=true` | 200 — 11 facilities |
| GET | `/metrc/locations?license=&sync=true` | 200 — 10 rows (grower license) |
| GET | `/metrc/strains?license=&sync=true` | 200 — 10 rows |
| GET | `/metrc/items?license=&sync=true` | 200 — 10 rows |
| GET | `/metrc/reference/location-types?license=` | 200 |
| GET | `/metrc/reference/item-categories?license=` | 200 |
| GET | `/metrc/reference/units-of-measure` | 200 — 12 UoM |
| POST | Metrc `transfers/v2/external/incoming` | 200 — Id 5801 |
| GET | Metrc `transfers/v2/incoming` | 200 — 1 shipment |

**Removed / never wired:** `GET /metrc/licenses` (frontend updated to use `/metrc/facilities`).

---

## 5. Frontend components created

| Component | Purpose |
|-----------|---------|
| `MetrcFacilityProvider` | Loads facilities, sandbox host, sync |
| `MetrcFacilityBar` | Dropdown + sync button |
| `MasterDataPanel` | Tabs for locations / strains / items / reference |
| `web/app/metrc/layout.tsx` | Wraps Metrc section with provider + bar |

---

## 6. Sandbox data created

| Entity | Count (SF-SBX-OK-3-8701) | Method |
|--------|--------------------------|--------|
| Facilities | 11 (all sandbox licenses) | API sync |
| Locations | 10 | POST + cache sync |
| Strains | 10 | POST + cache sync |
| Items | 10 | POST + cache sync |
| External incoming transfer | 1 (Id 5801) | POST certification run |

---

## 7. Testing evidence

- `python backend/scripts/seed_metrc_sandbox_master_data.py` — locations/strains/items created and cached
- `python backend/scripts/metrc_cert_external_incoming.py` — certification evidence written
- `python backend/scripts/upgrade_cannacore_metrc_master_data_schema.py` — tables ensured
- `npm run build` (web) — success, routes `/metrc`, `/metrc/[license]`
- FastAPI TestClient: master data routes 200 (prior session)
- Metrc API logs in `metrc_api_request_logs` with `workbook_section` tags

**Manual for workbook submission:** UI screenshots from Postman or Seed-To-Sale UI after `npm run dev` + backend `uvicorn`.

---

## 8. Known limitations

| Item | Detail |
|------|--------|
| PUT external incoming | OK sandbox requires `Transporters` on PUT; POST succeeded without |
| ExternalId | Disabled for recipient facility — omit on POST |
| Master data empty on other licenses | Seed script targets `METRC_LICENSE_NUMBER` only |
| Packages / plants / transfers UI | Quick actions disabled — Phase 2.3+ |
| Dashboard Metrc KPI | Not wired (out of scope) |
| `Shake` item category | OK uses `Shake/Trim bulk`, not literal `"Shake"` |
| Certification screenshots | Operator must capture for Metrc workbook PDF |

---

## 9. Phase 2.2 exit criteria checklist

| Criterion | Status |
|-----------|--------|
| Certification workbook external incoming captured | ✅ API evidence; ⚠️ manual screenshots |
| Facilities display in frontend | ✅ 11 in dropdown |
| Locations display in frontend | ✅ Tab + sync |
| Strains display in frontend | ✅ Tab + sync |
| Items display in frontend | ✅ Tab + sync |
| Sandbox test data exists | ✅ 10/10/10 on default grower license |
| GitHub updated | ⏳ Commit pushed (see git log) |
| Phase 2.2 Engineering Report | ✅ This document |

**Phase 2.2 complete when:** GitHub push confirmed + workbook screenshots submitted to Metrc.

---

## 10. Phase 2.3 readiness checklist

| Prerequisite | Ready? |
|--------------|--------|
| Facility context in UI | ✅ |
| Master data cached | ✅ |
| Request logging | ✅ |
| Sandbox guard | ✅ |
| Plant batches / packages / transfers API layer | ❌ Not started |
| Grower workflow buildout | ❌ Blocked per plan |

**Do not start Phase 2.3** until Metrc accepts certification workbook and product owner signs off Phase 2.2 exit criteria.

---

## 11. How to reproduce

```bash
# Backend
cd backend && source ../.venv/bin/activate
python scripts/upgrade_cannacore_metrc_master_data_schema.py
python scripts/seed_metrc_sandbox_master_data.py
python scripts/metrc_cert_external_incoming.py
uvicorn main:app --reload

# Frontend
cd web && npm run dev
# Open http://localhost:3000/metrc
```

Ensure `.env` has sandbox URL, `METRC_SANDBOX=true`, keys, and `METRC_LICENSE_NUMBER=SF-SBX-OK-3-8701` (or chosen grower license).
