# Legacy policy documents migration

Slow, run **after** policies are on the target Postgres.

**Production cutover:** follow [production-runbook.md](./production-runbook.md) — do **not** use `--skip-r2` on prod.

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

Document metadata is written to **`policy_document`**. Policies must already exist (`npm run db:migrate:legacy:*`). Rows without a matching `policy_car` record are skipped.

---

## What the script does

1. Read document rows from export snapshot (~28k)
2. For each row, find PDF under `POLICY_DOCUMENT_PATHS`
3. Upload to R2 bucket (set automatically by `--env`):

   | `--env` | Bucket                                       |
   | ------- | -------------------------------------------- |
   | `local` | `insurance-app-library-documents-local`      |
   | `uat`   | `insurance-app-library-documents-uat`        |
   | `prod`  | `insurance-app-library-documents-production` |

   Override: `R2_POLICY_DOCUMENTS_BUCKET`

4. Upsert **`policy_document`** **per document** as uploads succeed

Progress:

```
  resuming checkpoint — 12000 uploaded, 4 missing
documents 5000/28168 (23168 left, 18%) — uploaded 4996, missing 4
...
documents done — uploaded 28164, missing 4, skipped 12000 (checkpoint)
  checkpoint saved _archive/data/legacy-documents-sync-state.json
```

Re-run the same command after an interruption; completed uploads are skipped and Postgres keeps prior rows.

Checkpoint file (default): `_archive/data/legacy-documents-sync-state.json`

---

## Restart / clear

| Goal                            | Command                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Resume after interrupt          | Re-run `npm run db:migrate:legacy:documents:*` (default)                                                              |
| Ignore checkpoint               | `npm run db:migrate:legacy -- --env=local --only documents --no-resume --file _archive/data/legacy-export.json`       |
| Wipe migrated docs + checkpoint | `npm run db:clear:legacy:documents:local -- --confirm`                                                                |
| Wipe then re-migrate            | `npm run db:migrate:legacy -- --env=local --only documents --clear-documents --file _archive/data/legacy-export.json` |

Clear removes legacy rows from Postgres (`generationKey` starts with `legacy:`), deletes expected R2 keys from the export snapshot, and deletes the checkpoint file.

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
# Resume is default; custom checkpoint path
npm run db:migrate:legacy -- --env=local --only documents --sync-state /tmp/doc-sync.json --file _archive/data/legacy-export.json

# Clear migrated documents, then upload from scratch
npm run db:migrate:legacy -- --env=local --only documents --clear-documents --file _archive/data/legacy-export.json

# Skip R2 (metadata only — UAT/dev debugging; NOT for production)
npm run db:migrate:legacy -- --env=local --only documents --skip-r2 --file _archive/data/legacy-export.json

# Dry-run (scan + missing CSV, no R2/Postgres)
npm run db:migrate:legacy -- --env=local --only documents --dry-run --file _archive/data/legacy-export.json
```

---

## Verify

```sql
SELECT COUNT(*) FROM policy_document;

SELECT policy_id, COUNT(*) AS n
FROM policy_document
GROUP BY policy_id
ORDER BY n DESC
LIMIT 10;
```

App serves migrated PDFs via `/api/policies/:policyId/documents/r2?key=...`.

### Local dev

The document migration uploads PDFs to **remote** R2. Bucket per environment (see table above). Local `npm run dev` uses **remote bindings** for `LIBRARY_DOCUMENTS` in `wrangler.jsonc` (`"remote": true`) pointing at the `-local` bucket. Populate local R2 via `npm run deployment:bootstrap:r2 -- --only local` or `npm run db:copy:uat`. You also need Cloudflare auth for remote bindings (`npx wrangler login` or `CLOUDFLARE_API_TOKEN` in the environment Wrangler reads).

Without remote R2, migrated rows appear in Postgres but `/api/policies/:policyId/documents/r2` returns 404 (`File not found in storage`) because the local Miniflare bucket is empty.

---

## Related

- [production-runbook.md](./production-runbook.md) — full prod sequence including R2 backfill
