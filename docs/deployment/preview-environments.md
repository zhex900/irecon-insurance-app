# Preview environments (per-PR)

Spin up an isolated **Workers + R2** copy of UAT for each PR. All PR previews share **one** Supabase project (`.env.pr`); each deploy clears that DB and copies schema + data from UAT (`.env.uat`).

```bash
npm run deploy -- pr-11
npm run destroy -- pr-11
```

`npm run deploy` with no env name (or `uat`) deploys UAT to `https://uat.irecon.net`.

## Supabase layout (free plan)

| Project | Env file   | Role                                                 |
| ------- | ---------- | ---------------------------------------------------- |
| UAT     | `.env.uat` | Source of truth; never wiped by PR deployPREVIEW_ENV |
| PR      | `.env.pr`  | Shared preview DB; reset + UAT copy each deploy      |

Supabase branching is **not** used (requires Pro). Copy `.env.pr.example` → `.env.pr` and point it at your second Supabase project.

## What gets created per PR

| Resource             | Name pattern (example `pr-11`)                          |
| -------------------- | ------------------------------------------------------- |
| App Worker           | `insurance-app-pr-11` → `https://pr-11.irecon.net`      |
| PDF Worker           | `insurance-pdf-worker-pr-11` (private, service binding) |
| Excel Worker         | `insurance-excel-worker-pr-11`                          |
| R2 avatars           | `insurance-app-avatars-pr-11` (objects copied from UAT) |
| R2 library documents | `insurance-app-library-documents-pr-11` (from UAT)      |
| Hyperdrive           | `insurance-app-pr-11` → shared PR Postgres              |
| Database             | Shared PR Supabase project (same for every PR number)   |

Infra targets (Hyperdrive limits, Supabase pool size, Worker CPU) live in [`scripts/lib/infra-settings.mjs`](../scripts/lib/infra-settings.mjs). Deploy applies Hyperdrive limits automatically; Supabase pool size is set manually in each project's dashboard.

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
- `.env.pr` only for PR deploy — includes PR Supabase, `UAT_DATABASE_URL` copy source, and Cloudflare (`[.env.pr.example](../.env.pr.example)`)
- R2 S3 API credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`) and [AWS CLI](https://aws.amazon.com/cli/) for UAT → preview R2 copy
- Docker or local `psql` (for UAT → PR database copy)
- `SUPABASE_ACCESS_TOKEN` in `.env.pr` (optional — Auth redirect URLs on PR project)

## Commands

```bash
# Full deploy: clear PR DB, copy UAT, migrate, copy R2, deploy Workers
npm run deploy -- pr-11

# Redeploy code only (skip DB reset + R2)
npm run deploy -- pr-11 -- --skip-db --skip-r2

# Skip migrations after UAT copy
npm run deploy -- pr-11 -- --skip-migrate

# Dry run
npm run deploy -- pr-11 -- --dry-run

# Tear down Workers/R2/Hyperdrive (PR Supabase project kept)
npm run destroy -- pr-11
```

## Database flow

1. **Dump UAT** — roles, schema, data from `UAT_DATABASE_URL` in `.env.pr`
2. **Clear PR DB** — drop `public`, truncate `auth.users` / `storage.objects`
3. **Restore** — into PR database
4. **Sync migration history** — copy `supabase_migrations.schema_migrations` from UAT so old migrations are not re-run
5. **Migrate** — `supabase db push` applies only migrations in this branch that are not yet on UAT
6. **Hyperdrive** — preview Worker connects to PR database

## CI (GitHub Actions)

| Workflow         | Trigger             | What runs                                                |
| ---------------- | ------------------- | -------------------------------------------------------- |
| `pr-preview.yml` | PR opened / updated | Quality → `npm run deploy:pr` → E2E → PR comment         |
| `pr-cleanup.yml` | PR closed           | `npm run destroy:pr`; on **merge**, `npm run deploy:uat` |

Workflows write `.env.pr` / `.env.uat` at runtime via `scripts/ci-write-env.mjs` from GitHub **environments** + **repository** secrets (no monolithic env-file secret).

### GitHub environment: `uat`

| Name                       | Kind     | Used by    |
| -------------------------- | -------- | ---------- |
| `APP_URL`                  | variable | UAT deploy |
| `DATABASE_URL`             | secret   | UAT deploy |
| `SUPABASE_URL`             | secret   | UAT deploy |
| `SUPABASE_PUBLISHABLE_KEY` | secret   | UAT deploy |
| `SUPABASE_SECRET_KEY`      | secret   | UAT deploy |

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
