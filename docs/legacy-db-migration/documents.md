# Legacy policy documents migration

Slow, run **after** policies are on the target Postgres.

---

## Commands

| Environment | Command                                     |
| ----------- | ------------------------------------------- |
| Local       | `npm run db:migrate:legacy:documents:local` |
| UAT         | `npm run db:migrate:legacy:documents:uat`   |
| Production  | `npm run db:migrate:legacy:documents:prod`  |

Uses `_archive/data/legacy-export.json` by default (no MSSQL re-export).

---

## Prerequisites

### `.env` (source machine)

```env
POLICY_DOCUMENT_PATHS="/Desktop/output_folder/Destination,/Desktop/output_folder/Source"
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

Paths are searched in order; first match wins.

### Policies on target

Document metadata is written to **`policy_car.app_extras.documents`**. Policies must already exist (`npm run db:migrate:legacy:*`). Rows without a matching `policy_car` record are skipped.

---

## What the script does

1. Read document rows from export snapshot (~28k)
2. For each row, find PDF under `POLICY_DOCUMENT_PATHS`
3. Upload to R2 bucket **`insurance-app-library-documents`**
4. After **all** uploads, update `policy_car.app_extras.documents` per policy

Progress:

```
documents 5000/28168 (23168 left, 18%) — uploaded 4996, missing 4
...
documents done — uploaded 28164, missing 4
Updating app_extras.documents on XXXX policies…
```

**Postgres is not updated until the upload loop finishes.**

---

## Missing files

Missing = MSSQL row exists but PDF not on disk. Written to:

`_archive/data/legacy-documents-missing.csv`

Override path:

```bash
npm run db:migrate:legacy -- --env=local --only documents --missing-csv /tmp/missing.csv
```

Skip CSV: `--no-missing-csv`

---

## Useful flags

```bash
# Skip R2 (metadata only — files must still exist on disk for the scan)
npm run db:migrate:legacy -- --env=local --only documents --skip-r2 --file _archive/data/legacy-export.json

# Dry-run (scan + missing CSV, no R2/Postgres)
npm run db:migrate:legacy -- --env=local --only documents --dry-run --file _archive/data/legacy-export.json
```

---

## Verify

```sql
SELECT COUNT(*) FROM policy_car
WHERE jsonb_array_length(app_extras->'documents') > 0;

SELECT policy_id, jsonb_array_length(app_extras->'documents') AS n
FROM policy_car
WHERE jsonb_array_length(app_extras->'documents') > 0
LIMIT 10;
```

App serves migrated PDFs via `/api/policies/:policyId/documents/r2?key=...`.
