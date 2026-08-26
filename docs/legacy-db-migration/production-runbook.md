# Production runbook: legacy MSSQL → Postgres

Step-by-step guide for loading **production** Supabase from legacy MSSQL (or from a validated UAT copy).

**Scope:** CAR policies with `InceptionDate >= 2025-06-01` (~5k policies, ~28k documents). See [README.md](./README.md) for slice details.

---

## Choose a path

| Path                            | When to use                                                         |
| ------------------------------- | ------------------------------------------------------------------- |
| **A — Legacy → prod directly**  | First production cutover; UAT not yet trusted                       |
| **B — UAT first, then copy DB** | UAT fully validated (app, documents, R2); faster prod Postgres load |

Both paths need **R2 policy PDFs** in `insurance-app-library-documents-production`. Path B copies Postgres only — you still need document bytes in prod R2 (re-run document migrate to prod, or sync buckets manually).

---

## Prerequisites

### On your machine

1. **Local MSSQL** restored — [mssql-setup.md](./mssql-setup.md)
2. **`.env`** — MSSQL connection + document PDF folders:

   ```env
   MSSQL_HOST=127.0.0.1
   MSSQL_PORT=1433
   MSSQL_USER=...
   MSSQL_PASSWORD=...
   MSSQL_DATABASE=vs434253_1

   POLICY_DOCUMENT_PATHS="/path/to/legacy/pdfs/Destination,/path/to/legacy/pdfs/Source"
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   ```

3. **AWS CLI** — required for R2 uploads (`aws --version`)
4. **Cloudflare auth** — `CLOUDFLARE_API_TOKEN` in `.env.uat` / `.env.production`, or `npx wrangler login`

### Production env file

Copy `.env.production.example` → `.env.production`:

- `DATABASE_URL` — Supabase **pooler** (port **6543**)
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
- `APP_URL=https://app.irecon.net`
- `RESEND_API_KEY`, `EMAIL_FROM` (for email smoke test after cutover)

Scripts load prod via `--env=prod` → `.env.production`.  
Document uploads target bucket **`insurance-app-library-documents-production`** automatically (override: `R2_POLICY_DOCUMENTS_BUCKET`).

### App code on production Workers

Production must run the **R2-only policy document** code (metadata in Postgres, PDF bytes in R2).  
If schema migrations drop `pdf_base64` / `merge_inputs` while old Workers are still live, **every policy page 500s**.

**Safe deploy order for this release:**

```bash
# 1. Ship new Workers first (schema can still have blob columns)
npm run deploy:prod -- --skip-migrate

# 2. Apply Supabase migrations (session URL = pooler with port 5432)
DB_URL="$(node --env-file=.env.production -e "
  const u = process.env.DATABASE_URL.replace(/:6543\\//, ':5432/');
  process.stdout.write(u);
")"
npx supabase db push --yes --db-url "$DB_URL"
```

Or publish a GitHub Release after merge to `main` — but use `--skip-migrate` on the first deploy if migrations are not yet applied, then `db push` separately.

**Pending migrations** (apply in timestamp order under `supabase/migrations/`):

1. `20260821100000_normalize_app_extras.sql`
2. `20260826100000_policy_child_uuid_ids.sql`
3. `20260826110000_repair_legacy_child_uuids.sql`
4. `20260826120000_policy_document_r2_only.sql` — nulls inline PDF blobs
5. `20260826130000_drop_policy_document_blob_columns.sql` — drops blob columns

Do **not** run `20260826120000` / `20260826130000` until template documents have `r2_key` (or you accept regenerating PDFs from live policy data).

---

## Path A — Legacy MSSQL → production

Run from repo root. **UAT/prod commands require `--confirm`** (baked into npm scripts below).

### Phase 1 — Export snapshot (MSSQL → JSON)

```bash
npm run db:export:legacy
# → _archive/data/legacy-export.json
```

Review printed row counts before loading anywhere.

### Phase 2 — Dry-run against prod

```bash
npm run db:migrate:legacy -- --env=prod --dry-run --only account-managers,ar,clients,policies
npm run db:migrate:legacy -- --env=prod --dry-run --only documents --file _archive/data/legacy-export.json
```

### Phase 3 — Clear existing migrated data (if re-running)

**Destructive** — wipes legacy-tagged domain rows on production.

```bash
npm run db:clear:legacy:prod -- --dry-run
npm run db:clear:legacy:prod -- --confirm
```

Documents only:

```bash
npm run db:clear:legacy:documents:prod -- --dry-run
npm run db:clear:legacy:documents:prod -- --confirm
```

### Phase 4 — Domain migrate (Postgres only)

Account managers → AR → clients → policies. **Does not upload PDFs.**

```bash
npm run db:migrate:legacy:prod
```

Expected approximate counts:

| Slice            | Rows  |
| ---------------- | ----- |
| Account managers | 7     |
| AR               | 689   |
| Clients          | 2,732 |
| Policies         | 5,101 |

### Phase 5 — Repairs

```bash
npm run db:repair:policy-periods -- --env=prod --confirm
npm run db:repair:migrated-policies -- --env=prod --confirm
```

### Phase 6 — Documents (R2 + `policy_document`)

**Do not use `--skip-r2` on production.** PDFs must land in R2 before blob-column migrations.

```bash
npm run db:migrate:legacy:documents:prod
```

- Uses `_archive/data/legacy-export.json` (no MSSQL re-query)
- Uploads to `insurance-app-library-documents-production`
- Checkpoint: `_archive/data/legacy-documents-sync-state.json` — safe to re-run after interrupt
- Missing PDFs: `_archive/data/legacy-documents-missing.csv`

Long-running (~28k files). Monitor:

```
documents 5000/28168 … — uploaded …, missing …
checkpoint saved _archive/data/legacy-documents-sync-state.json
```

See [documents.md](./documents.md) for flags (`--no-resume`, `--clear-documents`, etc.).

### Phase 7 — Template docs without `r2_key` (if any)

If some rows were loaded with `--skip-r2` or predate R2 upload, regenerate and upload:

```bash
npm run db:repair:policy-document-r2 -- --env=prod --confirm --dry-run
npm run db:repair:policy-document-r2 -- --env=prod --confirm
```

Requires AWS CLI + R2 creds. Regenerates PDFs from published templates + live policy data.

### Phase 8 — Reference / template data (if not already on prod)

Push published content UAT already uses:

```bash
npm run db:push:templates:uat      # adjust script if prod push exists; or copy via admin UI
npm run db:push:email-templates:uat
npm run db:push:additional-wording:uat
```

Confirm document templates and library documents exist in prod before smoke-testing PDF generation.

### Phase 9 — Deploy production app

```bash
npm run deploy:prod
# or publish GitHub Release (non-prerelease) → CI runs deploy:prod
```

If migrations were applied manually in Phase 0, use `npm run deploy:prod -- --skip-migrate`.

---

## Path B — Validate on UAT, copy Postgres to prod

### 1. Complete Path A on **UAT** first

```bash
npm run db:migrate:legacy:uat
npm run db:repair:policy-periods -- --env=uat --confirm
npm run db:repair:migrated-policies -- --env=uat --confirm
npm run db:migrate:legacy:documents:uat    # with R2 — no --skip-r2
npm run deploy:uat
```

Smoke-test on https://uat.irecon.net: policy list, open policy, preview PDF, email documents, adjustment.

### 2. Copy UAT Postgres → production

**Destructive** — replaces production database.

```bash
npm run db:copy:prod -- --dry-run
npm run db:copy:prod -- --confirm
```

Reads `.env.uat` (source) and `.env.production` (target). Does **not** copy R2.

### 3. Policy PDFs in production R2

Pick one:

- **Re-run document migrate to prod** (uploads from `POLICY_DOCUMENT_PATHS` into prod bucket; checkpoint skips already-uploaded keys if same export), or
- **Manual bucket sync** UAT → production library bucket (Cloudflare R2 / S3 API)

### 4. Deploy production Workers

```bash
npm run deploy:prod -- --skip-migrate   # schema already matches UAT after copy
```

---

## Verification (production)

### SQL

```sql
-- Domain rows
SELECT COUNT(*) FROM policy WHERE created_by = 'migrate:mssql';
SELECT COUNT(*) FROM client;
SELECT COUNT(*) FROM authorised_representative;

-- Documents
SELECT COUNT(*) FROM policy_document;
SELECT COUNT(*) FILTER (WHERE r2_key IS NOT NULL AND r2_key <> '') AS with_r2
FROM policy_document
WHERE template_key IS NOT NULL;

-- Blob columns should be gone after migration 20260826130000
SELECT column_name FROM information_schema.columns
WHERE table_name = 'policy_document'
  AND column_name IN ('pdf_base64', 'merge_inputs');
-- expect 0 rows
```

### App smoke test

1. Log in at https://app.irecon.net
2. Open a migrated policy (Taken status)
3. Preview schedule / rating PDF
4. Regenerate documents (Review step)
5. Send policy documents email (Resend)
6. Run an adjustment finish (if applicable)

### Sentry

Watch for 500s on `GET /policies/*.data` after deploy — usually code/schema mismatch or missing R2 keys.

---

## Command cheat sheet (production)

| Step               | Command                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Export MSSQL       | `npm run db:export:legacy`                                                                      |
| Dry-run domain     | `npm run db:migrate:legacy -- --env=prod --dry-run --only account-managers,ar,clients,policies` |
| Clear domain       | `npm run db:clear:legacy:prod -- --confirm`                                                     |
| Migrate domain     | `npm run db:migrate:legacy:prod`                                                                |
| Repair periods     | `npm run db:repair:policy-periods -- --env=prod --confirm`                                      |
| Repair policies    | `npm run db:repair:migrated-policies -- --env=prod --confirm`                                   |
| Migrate documents  | `npm run db:migrate:legacy:documents:prod`                                                      |
| R2 backfill        | `npm run db:repair:policy-document-r2 -- --env=prod --confirm`                                  |
| Copy UAT → prod DB | `npm run db:copy:prod -- --confirm`                                                             |
| Schema migrations  | `npx supabase db push --yes --db-url "<session url :5432>"`                                     |
| Deploy app         | `npm run deploy:prod`                                                                           |

All `db:migrate:legacy:*:prod` and `db:clear:legacy:*:prod` scripts include `--confirm`.

---

## Common mistakes

| Mistake                                             | Consequence                                              |
| --------------------------------------------------- | -------------------------------------------------------- |
| `--skip-r2` on document migrate (prod)              | Metadata only; PDF preview/email fails until R2 backfill |
| Run blob-drop migrations before R2 upload           | Permanent loss of stored PDF bytes                       |
| `supabase db push` before new Workers deploy        | Policy pages 500 until new code is live                  |
| Document migrate before domain migrate              | Rows skipped (no matching policy)                        |
| Missing `POLICY_DOCUMENT_PATHS`                     | High missing count in CSV; empty R2                      |
| Using localhost `DATABASE_URL` in `.env.production` | Scripts refuse to run                                    |

---

## Related docs

- [README.md](./README.md) — overview, local steps, slice reference
- [documents.md](./documents.md) — document migration detail
- [mappings.md](./mappings.md) — field mapping summary
- [../architecture/interim-data-patterns.md](../architecture/interim-data-patterns.md) — R2-only `policy_document` model
- [../deployment/preview-environments.md](../deployment/preview-environments.md) — prod GitHub secrets, deploy CI
- [../domain.md](../domain.md) — production URLs and Workers
