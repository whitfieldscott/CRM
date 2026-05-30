# CannaCore SQL → ETL → Fabric Study Guide

**Audience:** Beginner-friendly, professional  
**Project:** CannaCore / ArkOne Systems (CRM repo)  
**Purpose:** Learn SQL, ETL, data modeling, and Microsoft Fabric using this codebase as a real case study.

You do not need to change any application code to follow this guide. Practice queries run against **local SQLite** files on your machine.

---

## How to use this guide

1. Read each section in order once.
2. Open the referenced files in the repo and match concepts to code.
3. Run the practice SQL at the end against `backend/cannacore.db`.
4. Sketch how each step would look in Fabric (Lakehouse tables, pipelines, Power BI).

**Related docs:** [06_DATABASE_REBUILD_AND_MERGE_PLAN.md](../06_DATABASE_REBUILD_AND_MERGE_PLAN.md)

---

## 1. Where SQL and database logic live in this repo

| Location | Role |
|----------|------|
| `backend/database.py` | Production CRM database connection → **`app.db`** |
| `backend/cannacore_database.py` | Staging/analytics connection → **`cannacore.db`** |
| `backend/models.py` | SQLAlchemy models (Python classes → SQL tables) for CRM |
| `backend/cannacore_models.py` | SQLAlchemy models for license merge staging |
| `backend/main.py` | FastAPI routes that **read/write** `app.db` at runtime |
| `backend/scripts/*.py` | **Batch ETL** jobs that read files and write `cannacore.db` |
| `data/raw/` | Source Excel files (OMMA, Metrc) — like files in a data lake landing zone |
| `data/reports/` | Generated audit CSVs/JSON (gitignored) |

**Key idea:** The live CRM app and the CannaCore rebuild pipeline use **two separate databases**. That mirrors Fabric patterns where operational apps and analytics warehouses are often split.

```
data/raw/omma/*.xlsx  ──┐
data/raw/metrc/*.xlsx ──┼──► scripts (ETL) ──► cannacore.db (staging/analytics)
                        │
web/ + FastAPI ─────────┴──► app.db (operational CRM)
```

---

## 2. `backend/models.py` — relational tables for the CRM

SQLAlchemy **models** are Python classes that map to **SQL tables**. Each `Column(...)` becomes a column; `ForeignKey` creates relationships between tables.

### Core entities (operational / “app” layer)

| Model | Table | Purpose |
|-------|-------|---------|
| `Contact` | `contacts` | Marketing contacts (email is unique key today) |
| `Client` | `clients` | Relationship CRM record with notes |
| `ClientNote` | `client_notes` | One-to-many notes per client |
| `CampaignLog` | `campaign_logs` | Bulk email campaign summary |
| `EmailSendRecord` | `email_send_records` | Per-recipient send history |
| `Unsubscribe` | `unsubscribes` | Local suppression list |
| `SmsCampaignLog` | `sms_campaign_logs` | SMS campaign summary |

### Relational concepts illustrated

```python
# ForeignKey = link to another table's primary key
client_id = Column(Integer, ForeignKey("clients.id"), ...)

# relationship = ORM navigation (JOINs in Python)
client = relationship("Client", back_populates="notes_timeline")
```

**SQL equivalent:**

```sql
SELECT c.name, n.note
FROM clients c
JOIN client_notes n ON n.client_id = c.id;
```

**Design note:** `Contact` is **email-centric** (one row per email). CannaCore staging moves toward **license-centric** modeling (`licenses` in `cannacore.db`), which is closer to how regulated cannabis data actually works in Oklahoma (OMMA / Metrc license numbers).

---

## 3. `backend/cannacore_models.py` — staging / analytics schema

This file defines the **OMMA + Metrc merge** data model. Think of it as a **dimensional / staging warehouse** design, not the CRM UI database.

### Layer groups (conceptual)

| Group | Tables | Analogy |
|-------|--------|---------|
| **Lineage / audit** | `source_files`, `import_runs` | Pipeline run metadata, file checksums |
| **Bronze (raw)** | `raw_omma_licenses`, `raw_metrc_licenses` | One row per source row, plus `raw_json` |
| **Gold (merged)** | `companies`, `licenses`, `contact_points` | Business-ready entities |
| **Quality / history** | `data_conflicts`, `license_change_events`, `metrc_snapshots` | Data quality queue, SCD-style events |

### Important relationships

```
source_files (1) ──► (many) raw_omma_licenses
source_files (1) ──► (many) raw_metrc_licenses

licenses (1) ──► (many) contact_points     -- email, phone per license
licenses (1) ──► (many) license_source_links ──► raw rows (provenance)
licenses (1) ──► (many) data_conflicts     -- OMMA vs Metrc disagreements

companies (1) ──► (1) licenses             -- Phase E: one company per license
```

### Normalization columns (Phase D)

Raw tables gain **status fields** after cleaning:

- `license_validation_status` — `valid` | `missing` | `invalid_format`
- `duplicate_classification` — e.g. `exact_duplicate_row`, `missing_license_quarantine`
- `normalization_status` — `complete` when Phase D has run

These are **data quality flags**, similar to validation rules in Fabric Dataflows.

---

## 4. `app.db` vs `cannacore.db`

| | **`backend/app.db`** | **`backend/cannacore.db`** |
|--|----------------------|----------------------------|
| **Connection** | `backend/database.py` | `backend/cannacore_database.py` |
| **Models** | `backend/models.py` | `backend/cannacore_models.py` |
| **Used by** | FastAPI (`main.py`), campaigns, contacts | `backend/scripts/*` only |
| **Used by frontend** | Yes (`web/` → API → `app.db`) | No (not wired to UI yet) |
| **Purpose** | Live CRM: send email, manage contacts | Rebuild OMMA/Metrc license data safely |
| **Risk if broken** | Production outreach affected | Analytics/staging only |

**Why two databases?**

- You can **experiment** with imports, merges, and schema changes without breaking the CRM.
- Matches enterprise pattern: **OLTP** (operational) vs **analytics/staging** (reporting and integration).

**Future Phase G (planned):** Sync merged `licenses` → `contacts` in `app.db` when you trust the pipeline.

---

## 5. `import_raw_license_data.py` — ETL ingestion (Bronze)

**Script:** `backend/scripts/import_raw_license_data.py`

| ETL term | What the script does |
|----------|----------------------|
| **Extract** | Read Excel from `data/raw/omma/` and `data/raw/metrc/` |
| **Transform (minimal)** | Normalize license string, map columns, build `raw_json` |
| **Load** | Insert into `source_files`, `raw_omma_licenses`, `raw_metrc_licenses` |
| **Idempotency** | Skip file if SHA-256 already in `source_files` |

**Tables written:**

- `source_files` — one row per file (checksum, path, category)
- `import_runs` — one row per script execution
- `raw_*` — one row per spreadsheet row (today; Metrc merged-cell fix pending)

**Principles:**

- Do **not** delete or overwrite source Excel files.
- Do **not** modify `raw_json` after load (immutable audit trail).
- `source_file_id` + `row_number` is unique per raw row.

**Fabric parallel:** Copy activity / Dataflow source → **Bronze Lakehouse tables** (`raw_omma`, `raw_metrc`) with `_file_name`, `_ingested_at`, `_row_hash`.

---

## 6. `normalize_raw_licenses.py` — cleaning / Silver layer

**Script:** `backend/scripts/normalize_raw_licenses.py`

| Task | Example |
|------|---------|
| Validate license format | `GAAA-XXXX-XXXX` pattern |
| Normalize email | lowercase, trim, syntax check |
| Normalize phone | strip Excel float noise, E.164 for US |
| Classify duplicates | `exact_duplicate_row`, `duplicate_metrc_license` |
| Quarantine bad rows | `missing_license_quarantine` |
| Reports | `data/reports/normalization/*.csv` |

**Updates** existing raw rows (status columns only); does **not** delete raw data or change `raw_json`.

**Silver layer idea:** Same grain as Bronze (still one row per source row), but **validated, typed, flagged**. In Fabric you might write `silver_omma_licenses` and `silver_metrc_licenses` as separate tables or views.

**Known lesson from this project:** Metrc Excel uses **merged cells** — pandas created thousands of false “missing license” rows. Silver-layer rules must understand **source file structure**, not just column values.

---

## 7. `merge_grower_licenses.py` — Gold layer modeling

**Script:** `backend/scripts/merge_grower_licenses.py`

| Step | Output |
|------|--------|
| Match OMMA + Metrc on `license_number_normalized` | `licenses` |
| Create 1:1 `companies` | `companies` |
| Attach email (OMMA) + phone (Metrc) | `contact_points` |
| Link every contributing raw row | `license_source_links` |
| Flag disagreements | `data_conflicts` |

**Operational status examples:**

| Status | Meaning |
|--------|---------|
| `active_confirmed` | In both OMMA and Metrc (matched) |
| `omma_only` | Historical OMMA, not in current Metrc primary set |
| `metrc_only` | In Metrc, not in OMMA grower list |
| `marketing_caution` | Extra care before outreach (e.g. OMMA-only) |

**Gold layer idea:** **One row per license** (business key), enriched attributes, ready for CRM sync and Power BI.

**Fabric parallel:** Merge joins in Pipeline / SQL stored procedure → **`gold_licenses`**, **`gold_contact_points`**, **`gold_data_conflicts`**.

---

## 8. Bronze / Silver / Gold — CannaCore map

Medallion architecture is a common way to organize lakehouses. CannaCore already follows it in spirit:

```
┌─────────────────────────────────────────────────────────────────┐
│  LANDING (files)                                                │
│  data/raw/omma/*.xlsx   data/raw/metrc/*.xlsx                   │
└────────────────────────────┬────────────────────────────────────┘
                             │  import_raw_license_data.py
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  BRONZE — append-only raw tables                                │
│  source_files, raw_omma_licenses, raw_metrc_licenses            │
│  + raw_json, source_file_id, row_number                         │
└────────────────────────────┬────────────────────────────────────┘
                             │  normalize_raw_licenses.py
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  SILVER — cleaned / validated (same tables + status columns)    │
│  license_validation_status, duplicate_classification,           │
│  email_validation_status, phone_validation_status                 │
└────────────────────────────┬────────────────────────────────────┘
                             │  merge_grower_licenses.py
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  GOLD — business entities                                       │
│  companies, licenses, contact_points, data_conflicts            │
│  license_source_links (lineage back to Bronze)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │  (future Phase G)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  OPERATIONAL — CRM app                                          │
│  app.db → contacts, clients, campaign_logs                    │
└─────────────────────────────────────────────────────────────────┘
```

**Takeaway:** Bronze preserves **what the file said**. Silver adds **trust labels**. Gold adds **what the business believes** after merge rules.

---

## 9. Practice SQL queries (`cannacore.db`)

Open the database from repo root:

```bash
sqlite3 backend/cannacore.db
```

Enable readable output:

```sql
.headers on
.mode column
```

### 9.1 Explore tables

```sql
-- List all tables
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;
```

### 9.2 Bronze — row counts by source

```sql
SELECT
  sf.source_system,
  sf.license_category,
  sf.file_name,
  sf.row_count
FROM source_files sf
ORDER BY sf.source_system, sf.license_category;
```

```sql
SELECT COUNT(*) AS omma_raw_rows FROM raw_omma_licenses;
SELECT COUNT(*) AS metrc_raw_rows FROM raw_metrc_licenses;
```

### 9.3 Silver — data quality summary

```sql
SELECT
  license_validation_status,
  COUNT(*) AS cnt
FROM raw_metrc_licenses
GROUP BY license_validation_status
ORDER BY cnt DESC;
```

```sql
SELECT
  duplicate_classification,
  COUNT(*) AS cnt
FROM raw_metrc_licenses
GROUP BY duplicate_classification
ORDER BY cnt DESC;
```

### 9.4 Gold — operational status dashboard

```sql
SELECT
  operational_status,
  marketing_caution,
  COUNT(*) AS license_count
FROM licenses
WHERE license_category = 'grower'
GROUP BY operational_status, marketing_caution
ORDER BY license_count DESC;
```

### 9.5 JOIN — licenses with email and phone

```sql
SELECT
  l.license_number_normalized,
  l.business_name_display,
  l.operational_status,
  MAX(CASE WHEN cp.contact_type = 'email'  THEN cp.value_normalized END) AS email,
  MAX(CASE WHEN cp.contact_type = 'phone' THEN cp.value_normalized END) AS phone
FROM licenses l
LEFT JOIN contact_points cp ON cp.license_id = l.id
WHERE l.license_category = 'grower'
GROUP BY l.id
LIMIT 20;
```

### 9.6 JOIN — provenance (Gold → Bronze)

```sql
SELECT
  l.license_number_normalized,
  lsl.link_role,
  sf.source_system,
  sf.file_name
FROM licenses l
JOIN license_source_links lsl ON lsl.license_id = l.id
LEFT JOIN raw_omma_licenses ro ON ro.id = lsl.raw_omma_license_id
LEFT JOIN raw_metrc_licenses rm ON rm.id = lsl.raw_metrc_license_id
LEFT JOIN source_files sf ON sf.id = COALESCE(ro.source_file_id, rm.source_file_id)
WHERE l.license_number_normalized = 'GAAI-SUR5-I7VN'  -- example; pick one from your data
LIMIT 10;
```

### 9.7 Conflicts — review queue

```sql
SELECT
  l.license_number_normalized,
  dc.conflict_type,
  dc.severity,
  dc.conflict_status,
  dc.field_name
FROM data_conflicts dc
JOIN licenses l ON l.id = dc.license_id
WHERE dc.conflict_status = 'open'
ORDER BY dc.severity DESC, l.license_number_normalized
LIMIT 25;
```

### 9.8 OMMA-only growers (marketing caution)

```sql
SELECT
  license_number_normalized,
  business_name_display,
  city_display,
  county_display
FROM licenses
WHERE license_category = 'grower'
  AND operational_status = 'omma_only'
  AND marketing_caution = 1
LIMIT 20;
```

### 9.9 Practice exercises (try yourself)

1. Count **open conflicts** by `conflict_type`.
2. Find licenses with **email but no phone**.
3. Count how many **Metrc raw rows** link to one **Gold license** (hint: `license_source_links`).
4. Compare `COUNT(DISTINCT license_number_normalized)` in `raw_omma_licenses` vs `licenses` for growers.

---

## 10. Mapping CannaCore → Microsoft Fabric

Fabric is Microsoft’s SaaS analytics platform. Below is how **this repo’s patterns** translate—not a deployment guide, but a learning map.

### 10.1 OneLake + Lakehouse ≈ `data/raw` + Bronze tables

| CannaCore | Fabric |
|-----------|--------|
| `data/raw/omma/`, `data/raw/metrc/` | **Lakehouse Files** landing area (OneLake) |
| `raw_omma_licenses`, `raw_metrc_licenses` | **Bronze Delta tables** in Lakehouse |
| `raw_json` column | Semi-structured column or JSON file alongside Delta |
| `source_files.file_sha256` | Pipeline parameter / file metadata table |

**Activity type:** Copy data, Notebook (Spark), or **Dataflow Gen2** to ingest Excel → Delta.

### 10.2 Silver ≈ `normalize_raw_licenses.py`

| CannaCore | Fabric |
|-----------|--------|
| Validation status columns | Silver Delta tables with `_is_valid`, `_dq_reason` |
| Normalization reports | **Pipeline** failure alerts or Power BI **data quality** page |
| Duplicate classification | Window functions / `GROUP BY` in SQL or Power Query |

**Activity type:** Notebook, Dataflow Gen2, or **Stored procedure** in Warehouse.

### 10.3 Gold ≈ `merge_grower_licenses.py`

| CannaCore | Fabric |
|-----------|--------|
| `licenses`, `companies`, `contact_points` | **Gold Delta tables** or **Warehouse** fact/dimension tables |
| `data_conflicts` | DQ exception table for manual review in Power Apps |
| `license_source_links` | Lineage / bridge table (slowly changing dimension pattern) |

**Activity type:** **Pipeline** with SQL script activity, or dbt-style SQL project against Warehouse.

### 10.4 Warehouse + SQL analytics endpoint

| Concept | CannaCore today | Fabric |
|---------|-----------------|--------|
| Query language | SQL via `sqlite3` | **T-SQL** via Warehouse |
| Semantic layer | None (direct tables) | Optional **DirectLake** / dataset |
| CRM operational DB | `app.db` | Could stay in Azure SQL / remain SQLite locally |

The **SQL analytics endpoint** lets tools (Power BI, Excel, SSMS) query the Warehouse without copying data again—similar to how you query `cannacore.db` with `sqlite3`, but enterprise-scale.

### 10.5 Dataflows / Pipelines ≈ `backend/scripts/*.py`

| Script | Pipeline step |
|--------|----------------|
| `create_cannacore_db.py` | Deploy schema / CREATE TABLE |
| `import_raw_license_data.py` | **Ingest** (Bronze) |
| `normalize_raw_licenses.py` | **Transform** (Silver) |
| `merge_grower_licenses.py` | **Transform** (Gold) |
| `import_runs` table | Pipeline run history (built-in Fabric monitoring) |

In Fabric **Orchestration pipeline**:

1. Trigger (schedule or manual)
2. Copy / Notebook ingest
3. Dataflow normalize
4. SQL merge
5. Optional: refresh Power BI dataset

### 10.6 Power BI ≈ CRM dashboards + conflict review (future)

| Business question | SQL source | Power BI visual |
|-------------------|------------|-----------------|
| How many matched vs OMMA-only? | `licenses.operational_status` | Donut chart |
| Open data conflicts | `data_conflicts` | Table with filters |
| Growers missing phone | `contact_points` LEFT JOIN | KPI card |
| Campaign readiness | Gold + unsubscribe (future join to `app.db`) | Matrix |

**DirectLake** (when using Lakehouse Gold tables) reduces import refresh time—useful when Metrc snapshots grow monthly.

### 10.7 End-state architecture (learning target)

```
Excel / Metrc API
       │
       ▼
Fabric Pipeline (Bronze → Silver → Gold)
       │
       ├──► Lakehouse Gold tables
       ├──► Warehouse (SQL endpoint) ──► Power BI
       │
       └──► (future) API sync ──► app.db / Azure SQL CRM
```

CannaCore on your laptop is a **miniature** of this: scripts instead of pipelines, SQLite instead of OneLake, but the **medallion logic is the same**.

---

## Glossary (quick reference)

| Term | Meaning in CannaCore |
|------|----------------------|
| **Primary key** | `id` column; uniquely identifies a row |
| **Foreign key** | `license_id`, `source_file_id` — links tables |
| **Natural key** | `license_number_normalized` — business identifier |
| **ETL** | Extract (Excel) → Transform (normalize, merge) → Load (SQLite) |
| **Lineage** | `source_files` → raw → `license_source_links` → `licenses` |
| **SCD** | Slowly changing dimension; `license_change_events` (future Metrc diffs) |
| **Medallion** | Bronze / Silver / Gold quality tiers |

---

## Suggested learning path (1–2 weeks)

| Day | Activity |
|-----|----------|
| 1 | Run `sqlite3 backend/cannacore.db`, section 9.1–9.3 |
| 2 | Read `models.py` + draw ER diagram for CRM tables |
| 3 | Read `cannacore_models.py` + draw ER diagram for staging |
| 4 | Trace `import_raw_license_data.py` line-by-line |
| 5 | Trace `normalize_raw_licenses.py` + open normalization CSV reports |
| 6 | Trace `merge_grower_licenses.py` + run queries 9.4–9.7 |
| 7 | Recreate one merge query in SQL by hand (OMMA ⋈ Metrc) |
| 8 | Watch Microsoft Learn: “Medallion lakehouse architecture” |
| 9 | In Fabric trial: ingest a small Excel → Bronze → Gold notebook |
| 10 | Build one Power BI page mirroring query 9.4 |

---

## Document info

| Field | Value |
|-------|-------|
| Path | `docs/learning/01_CANNACORE_SQL_TO_FABRIC_STUDY_GUIDE.md` |
| Type | Learning / documentation only |
| App code | Not modified |

When Metrc Excel merged-cell import is fixed and `cannacore.db` is rebuilt, re-run the practice queries in section 9—Silver and Gold counts will better match inspection reports (~2,623 Metrc blocks, ~2,026 OMMA∩Metrc matches).
