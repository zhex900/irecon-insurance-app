# Legacy MSSQL → Postgres migration

Migrate domain data from the legacy **vs434253_1** MSSQL database into Supabase Postgres.

**Included in the main migrate:** account managers, authorised representatives (AR), clients, policies.

**Run separately (slow):** policy documents (PDF upload to R2 + `policy_car.app_extras.documents`).

### Target scope

Only **CAR policies with `InceptionDate >= 2025-06-01`** are exported. Clients without an in-scope policy are excluded. Documents, notes, and wordings follow the same policy set (no full-database R2 copy). Filter lives in `scripts/sql/legacy/_target-scope.sql`.

---

## Prerequisites

1. **Local MSSQL** restored — see [mssql-setup.md](./mssql-setup.md).
2. **Source env** (always `.env` on your machine):
   - `MSSQL_HOST`, `MSSQL_PORT`, `MSSQL_USER`, `MSSQL_PASSWORD`, `MSSQL_DATABASE`
3. **Target env** (Postgres):
   - `DATABASE_URL` in `.env` (local), `.env.uat`, or `.env.production`
4. **Documents only** (optional, for `--only documents`):
   - `POLICY_DOCUMENT_PATHS` — comma-separated PDF folders
   - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`

---

## Quick reference

### Clear (wipe migrated domain)

Removes **policies → clients → account managers → AR** on the target database.

| Environment | Command                         |
| ----------- | ------------------------------- |
| Local       | `npm run db:clear:legacy:local` |
| UAT         | `npm run db:clear:legacy:uat`   |
| Production  | `npm run db:clear:legacy:prod`  |

Add `-- --dry-run` to preview counts. Add `-- --confirm` to skip the interactive `yes` prompt.

### Clear documents only (migrated PDFs + checkpoint)

Removes legacy document rows from `policy_car.app_extras`, deletes expected R2 keys, and resets the sync checkpoint.

| Environment | Command                                   |
| ----------- | ----------------------------------------- |
| Local       | `npm run db:clear:legacy:documents:local` |
| UAT         | `npm run db:clear:legacy:documents:uat`   |
| Production  | `npm run db:clear:legacy:documents:prod`  |

### Migrate (account managers, AR, clients, policies — Postgres only)

Does **not** upload PDFs to R2. Export still includes document row counts for the separate documents step.

For UAT/prod, the command **exports and prints row counts first**; add `--confirm` to load after reviewing counts.

| Environment | Command                           |
| ----------- | --------------------------------- |
| Local       | `npm run db:migrate:legacy:local` |
| UAT         | `npm run db:migrate:legacy:uat`   |
| Production  | `npm run db:migrate:legacy:prod`  |

UAT and production require `--confirm` (already baked into the npm scripts above).

### Documents (separate — slow)

Run **after** policies exist on the target. Uses the export snapshot so MSSQL is not re-queried.

| Environment | Command                                     |
| ----------- | ------------------------------------------- |
| Local       | `npm run db:migrate:legacy:documents:local` |
| UAT         | `npm run db:migrate:legacy:documents:uat`   |
| Production  | `npm run db:migrate:legacy:documents:prod`  |

See [documents.md](./documents.md).

---

## Step-by-step (local)

### 1. Start Postgres

```bash
npm run db:start
```

### 2. Restore MSSQL (one-time)

Follow [mssql-setup.md](./mssql-setup.md).

### 3. Dry-run (optional)

```bash
npm run db:migrate:legacy -- --env=local --dry-run --only account-managers,ar,clients,policies
```

### 4. Clear existing legacy data (optional)

```bash
npm run db:clear:legacy:local -- --dry-run
npm run db:clear:legacy:local -- --confirm
```

### 5. Migrate domain

```bash
npm run db:migrate:legacy:local
```

Expected counts (approximate):

| Slice            | Rows  |
| ---------------- | ----- |
| Account managers | 7     |
| AR               | 689   |
| Clients          | 2,732 |
| Policies         | 5,101 |

### 6. Repair known field gaps (if needed)

```bash
npm run db:repair:policy-periods -- --env=local
npm run db:repair:migrated-policies -- --env=local
```

### 7. Migrate documents (optional, long-running)

First ensure an export snapshot exists (domain migrate writes one if you use `db:migrate:legacy` with `--write-json`, or export manually):

```bash
npm run db:export:legacy
# writes _archive/data/legacy-export.json
```

Then:

```bash
npm run db:migrate:legacy:documents:local
```

Re-run safely if interrupted — progress is checkpointed. Postgres updates happen as each document uploads.

Postgres updates happen incrementally during upload (not only at the end). Watch for:

```
  resuming checkpoint — …
  checkpoint saved _archive/data/legacy-documents-sync-state.json
```

### 8. Verify

```sql
SELECT COUNT(*) FROM policy WHERE created_by = 'migrate:mssql';
SELECT COUNT(*) FROM client;
SELECT COUNT(*) FROM authorised_representative;

SELECT COUNT(*) FROM policy_car
WHERE jsonb_array_length(app_extras->'documents') > 0;
```

---

## UAT / production

Same order as local. Scripts include `--confirm`.

```bash
# Preview
npm run db:migrate:legacy -- --env=uat --dry-run --only account-managers,ar,clients,policies

# Clear
npm run db:clear:legacy:uat -- --confirm

# Migrate
npm run db:migrate:legacy:uat

# Documents (after policies on target)
npm run db:migrate:legacy:documents:uat
```

---

## What each slice does

| Slice              | Legacy source                | Postgres target                                 |
| ------------------ | ---------------------------- | ----------------------------------------------- |
| `account-managers` | `AccountManager`             | `account_manager`                               |
| `ar`               | `WholesaleBroker`            | `authorised_representative`                     |
| `clients`          | `Client`                     | `client`                                        |
| `policies`         | `Policy` + `PolicyCAR`       | `policy`, `policy_car`, `policy_car_adjustment` |
| `documents`        | `PolicyDocument` + PDF files | R2 + `policy_car.app_extras.documents`          |

Load order: account managers → AR → clients → policies → documents.

SQL files: `scripts/sql/legacy/*.sql`  
Mapper code: `scripts/lib/legacy-policy-mapper.mts`

### Duplicate policy numbers (renewals)

Legacy reuses `PolicyNumber` across renewals. Postgres requires uniqueness. The earliest row keeps the base number; later rows suffix from **inception date** (`InceptionDate`), in order:

1. `ATCCWI0487-2024` (year)
2. `ATCCWI0487-2024-06` (year + month) — if year taken
3. `ATCCWI0487-2024-06-15` (full date) — if year-month taken
4. `ATCCWI0487-a1b2c3d4` (UUID hash) — if all date suffixes taken

Implemented in `dedupeLegacyPolicyNumbers()` (`scripts/lib/legacy-policy-mapper.mts`).

---

## Field mappings

See [mappings.md](./mappings.md) (summary + link to the full policy field audit).

---

## Advanced flags

Pass after `--` on any `db:migrate:legacy` command:

| Flag                   | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `--dry-run`            | Export + counts only; no writes                   |
| `--file <path>`        | Use JSON snapshot instead of MSSQL                |
| `--write-json [path]`  | Save export to `_archive/data/legacy-export.json` |
| `--only <slices>`      | Comma-separated slice list                        |
| `--replace`            | Truncate target tables per slice before load      |
| `--sql <slice> <path>` | Override export SQL for one slice                 |

---

## Related docs

- [mssql-setup.md](./mssql-setup.md) — Docker + restore backup
- [mappings.md](./mappings.md) — Legacy → Postgres field mapping
- [documents.md](./documents.md) — PDF / R2 migration
- [../domains/migration/legacy-policy-field-mapping.md](../domains/migration/legacy-policy-field-mapping.md) — Full policy field audit
