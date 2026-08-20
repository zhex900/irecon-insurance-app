# Preview environments (per-PR)

Spin up an isolated **Workers + R2** copy of UAT for each PR. All PR previews share **one** Supabase project (`.env.pr`); each deploy clears that DB and copies schema + data from UAT (`.env.uat`).

```bash
npm run deploy -- pr-11
npm run destroy -- pr-11
```

`npm run deploy` with no env name (or `uat`) deploys UAT to `https://uat.irecon.net`.

## R2 buckets (per environment)

Each environment has **dedicated R2 buckets** — nothing is shared between UAT, local, and production. **All PR previews share one pair of buckets** (`*-pr`); objects are not cleared or re-copied on each PR deploy.

| Environment       | Avatars bucket                     | Library documents bucket                     |
| ----------------- | ---------------------------------- | -------------------------------------------- |
| Legacy (source)   | `insurance-app-avatars`            | `insurance-app-library-documents`            |
| UAT               | `insurance-app-avatars-uat`        | `insurance-app-library-documents-uat`        |
| Local dev         | `insurance-app-avatars-local`      | `insurance-app-library-documents-local`      |
| PR previews (all) | `insurance-app-avatars-pr`         | `insurance-app-library-documents-pr`         |
| Production        | `insurance-app-avatars-production` | `insurance-app-library-documents-production` |

**One-time migration** from the legacy shared buckets (or UAT → PR):

```bash
npm run deployment:bootstrap:r2              # uat + local
npm run deployment:bootstrap:r2 -- --only uat
npm run deployment:bootstrap:r2 -- --from uat --only pr
```

Requires R2 S3 credentials and Cloudflare auth. Run once after upgrading; then deploy UAT so Worker bindings point at the `-uat` buckets.

## Supabase layout (free plan)

| Project | Env file   | Role                                            |
| ------- | ---------- | ----------------------------------------------- |
| UAT     | `.env.uat` | Source of truth; never wiped by PR deploy       |
| PR      | `.env.pr`  | Shared preview DB; reset + UAT copy each deploy |

Supabase branching is **not** used (requires Pro). Copy `.env.pr.example` → `.env.pr` and point it at your second Supabase project.

## What gets created per PR

| Resource             | Name pattern (example `pr-11`)                                               |
| -------------------- | ---------------------------------------------------------------------------- |
| App Worker           | `insurance-app-pr-11` → `https://pr-11.irecon.net`                           |
| PDF Worker           | `insurance-pdf-worker-pr-11` (private, service binding)                      |
| Excel Worker         | `insurance-excel-worker-pr-11`                                               |
| R2 avatars           | `insurance-app-avatars-pr` (shared; not cleared on deploy/destroy)           |
| R2 library documents | `insurance-app-library-documents-pr` (shared; not cleared on deploy/destroy) |
| Hyperdrive           | `insurance-app-pr` (shared; not deleted on destroy)                          |
| Database             | Shared PR Supabase project (same for every PR number)                        |

All `pr-*` Workers bind to one Hyperdrive config (`insurance-app-pr`, limit **15** origin connections). Set Supabase PR **Pool size** to **15** in the dashboard to match [`SUPABASE_POOL_SIZE.pr`](../../deployment/lib/constants.mjs).

**One-time cleanup:** delete orphaned per-PR Hyperdrive configs (`insurance-app-pr-4`, `insurance-app-pr-5`, …) in Cloudflare **Storage & databases → Hyperdrive** after the next deploy.

Deployment targets (Hyperdrive limits, Supabase pool size, Worker CPU) live in [`deployment/lib/constants.mjs`](../../deployment/lib/constants.mjs). Deploy applies Hyperdrive limits automatically; Supabase pool size is set manually in each project's dashboard.

Generated wrangler configs live in `.preview-envs/<env>/` (gitignored).

## Environment names

Use any label you like (`pr-11`, branch name, ticket id). `APP_URL` **is not set in** `.env.pr` — it is derived from the deploy slug and `BASE_URL`:

| `--env` | `BASE_URL=irecon.net` → Worker `APP_URL` |
| ------- | ---------------------------------------- |
| `pr-11` | `https://pr-11.irecon.net`               |
| `pr-1`  | `https://pr-1.irecon.net`                |

Non-`pr-*` slugs fall back to `*.workers.dev`.

```bash
npm run deploy -- pr-11
PREVIEW_ENV=pr-11 npm run deploy
```

## Prerequisites

- Wrangler logged in or `CLOUDFLARE_API_TOKEN` in `.env.pr`
- `.env.pr` only for PR deploy — includes PR Supabase, `UAT_DATABASE_URL` copy source, and Cloudflare ([`.env.pr.example`](../.env.pr.example))
- R2 S3 API credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`) and [AWS CLI](https://aws.amazon.com/cli/) for UAT → preview R2 copy
- Docker or local `psql` (for UAT → PR database copy)
- `SUPABASE_ACCESS_TOKEN` in `.env.pr` (optional — Auth redirect URLs on PR project)

## Commands

```bash
# Full deploy: clear PR DB, copy UAT, migrate, deploy Workers (R2 unchanged)
npm run deploy -- pr-11

# Redeploy code only (skip DB reset)
npm run deploy -- pr-11 -- --skip-db

# Skip migrations after UAT copy
npm run deploy -- pr-11 -- --skip-migrate

# Dry run
npm run deploy -- pr-11 -- --dry-run

# Tear down Workers only (shared PR Hyperdrive, R2 + Supabase kept)
npm run destroy -- pr-11

# Local: full UAT → local Supabase
npm run db:copy:uat
```

## Database flow

1. **Dump UAT** — roles, schema, data from `UAT_DATABASE_URL` in `.env.pr`
2. **Clear PR DB** — drop `public`, truncate `auth.users` / `storage.objects`
3. **Restore** — into PR database
4. **Sync migration history** — copy `supabase_migrations.schema_migrations` from UAT so old migrations are not re-run
5. **Migrate** — `supabase db push` applies only migrations in this branch that are not yet on UAT
6. **R2** — shared PR buckets; created if missing, objects left as-is (populate once via `deployment:bootstrap:r2 -- --from uat --only pr`)
7. **Hyperdrive** — preview Worker connects to PR database

## CI (GitHub Actions)

| Workflow         | Trigger                      | What runs                                                |
| ---------------- | ---------------------------- | -------------------------------------------------------- |
| `pr-preview.yml` | PR opened / updated          | Quality → `npm run deploy:pr` → E2E → PR comment         |
| `pr-cleanup.yml` | PR closed                    | `npm run destroy:pr`; on **merge**, `npm run deploy:uat` |
| `release.yml`    | GitHub Release **published** | `npm run deploy:prod` (non-prerelease only)              |

Workflows write `.env.pr` / `.env.uat` at runtime via `deployment/ci-write-env.mjs` from GitHub **environments** + **repository** secrets (no monolithic env-file secret).

### GitHub environment: `uat`

| Name                       | Kind     | Used by                  |
| -------------------------- | -------- | ------------------------ |
| `APP_URL`                  | variable | UAT deploy               |
| `DATABASE_URL`             | secret   | UAT deploy               |
| `SUPABASE_URL`             | secret   | UAT deploy               |
| `SUPABASE_PUBLISHABLE_KEY` | secret   | UAT deploy               |
| `SUPABASE_SECRET_KEY`      | secret   | UAT deploy               |
| `VITE_TURNSTILE_SITE_KEY`  | secret   | optional — login captcha |
| `TURNSTILE_SECRET_KEY`     | secret   | optional — login captcha |

### GitHub environment: `production`

Configure **required reviewers** on this environment before first use.

| Name                       | Kind     | Used by                  |
| -------------------------- | -------- | ------------------------ |
| `APP_URL`                  | variable | Production deploy        |
| `DATABASE_URL`             | secret   | Production deploy        |
| `SUPABASE_URL`             | secret   | Production deploy        |
| `SUPABASE_PUBLISHABLE_KEY` | secret   | Production deploy        |
| `SUPABASE_SECRET_KEY`      | secret   | Production deploy        |
| `CLOUDFLARE_API_TOKEN`     | secret   | Wrangler deploy          |
| `VITE_TURNSTILE_SITE_KEY`  | secret   | optional — login captcha |
| `TURNSTILE_SECRET_KEY`     | secret   | optional — login captcha |

### GitHub environment: `pr`

| Name                       | Kind     | Used by                 |
| -------------------------- | -------- | ----------------------- |
| `BASE_URL`                 | variable | PR deploy / destroy     |
| `DATABASE_URL`             | secret   | PR Supabase (target)    |
| `SUPABASE_URL`             | secret   | PR Supabase             |
| `SUPABASE_PUBLISHABLE_KEY` | secret   | PR Supabase             |
| `SUPABASE_SECRET_KEY`      | secret   | PR Supabase             |
| `UAT_DATABASE_URL`         | secret   | UAT copy source         |
| `UAT_SUPABASE_URL`         | secret   | UAT copy source         |
| `SUPABASE_ACCESS_TOKEN`    | secret   | optional — PR Auth URLs |
| `CLOUDFLARE_API_TOKEN`     | secret   | Wrangler deploy/destroy |

### Repository secrets (shared)

`RESEND_API_KEY`, `SENTRY_AUTH_TOKEN`, `VITE_SENTRY_DSN`, `SENTRY_DSN`, `SUPABASE_ACCESS_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`

Turnstile is **not** configured on PR previews (login has no captcha; Playwright E2E runs without Turnstile). UAT/production use `VITE_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` from their environment secrets.

### Repository variables (shared)

`EMAIL_FROM`, `SENTRY_ORG`, `SENTRY_PROJECT`

`CLOUDFLARE_API_TOKEN` — add as a repository secret (or in `pr` / `uat` environment) for Wrangler deploy in CI.

Fork PRs skip deploy/E2E (no secrets on forks). UAT deploy runs only when a PR is **merged** to the base branch (not on close-without-merge).

See also [domain.md](../domain.md) for hostname setup.
