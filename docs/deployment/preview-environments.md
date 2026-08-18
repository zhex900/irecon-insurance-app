# Preview environments (per-PR)

Spin up an isolated copy of staging on Cloudflare Workers + Supabase, then tear it down.

```bash
npm run deploy --env pr-11
npm run destroy --env pr-11
```

`npm run deploy` with no `--env` (or `--env staging`) still deploys staging.

## What gets created

| Resource             | Name pattern (example `pr-11`)                                                  |
| -------------------- | ------------------------------------------------------------------------------- |
| App Worker           | `insurance-app-pr-11` → `https://insurance-app-pr-11.zhex900.workers.dev`       |
| PDF Worker           | `insurance-pdf-worker-pr-11` (private, service binding)                         |
| Excel Worker         | `insurance-excel-worker-pr-11`                                                  |
| R2 avatars           | `insurance-app-avatars-pr-11` (objects copied from staging)                     |
| R2 library documents | `insurance-app-library-documents-pr-11` (objects copied from staging)           |
| Hyperdrive           | `insurance-app-pr-11` → preview Postgres                                        |
| Supabase project     | `insurance-app-pr-11` (logical dump/restore from staging, including Auth users) |

Generated wrangler configs and the DB password live in `.preview-envs/<env>/` (gitignored).

## Environment names

Use any label you like (branch name, ticket id, `pr-11`, `pr-code-review-refactor`, etc.). Rules:

- Not empty; max 128 characters
- Not reserved: `staging`, `production`, `prod`, `local`, `development`, `dev`, `excel`, `pdf`
- No path separators (`/`, `\`, `:`)

Cloudflare and Supabase resource names are derived from your label (lowercased, non-alphanumeric → hyphens). Very long names are shortened with a hash suffix so R2 bucket names stay within limits. Local state under `.preview-envs/` keeps your original label.

```bash
npm run deploy --env pr-code-review-refactor
npm run deploy --env=pr-code-review-refactor
PREVIEW_ENV=pr-code-review-refactor npm run deploy
```

## Prerequisites

- Wrangler logged in (`npx wrangler login`) or `CLOUDFLARE_API_TOKEN`
- `.env.staging` filled in (same file as staging deploys)
- `SUPABASE_ACCESS_TOKEN` in `.env.staging` ([personal access token](https://supabase.com/dashboard/account/tokens))
- `SUPABASE_ORG_ID` if the token can see more than one org (`npx supabase orgs list`)
- Docker (Supabase CLI uses it for `db dump`)
- `psql` **or** Docker, for restore

Preview projects count against your Supabase org quota (free plan uses default compute; paid orgs can set `PREVIEW_DB_SIZE=micro`). Destroy them when the PR is done.

## Commands

```bash
# Deploy (creates infra on first run; reuses Supabase/Hyperdrive/R2 buckets after)
npm run deploy --env pr-11

# Redeploy: refreshes DB + R2 from staging, redeploys Workers (no infra recreation)
npm run deploy --env pr-11

# Code-only redeploy (skip staging data copy)
npm run deploy --env pr-11 -- --skip-db --skip-r2

# Print names without creating anything
npm run deploy --env pr-11 -- --dry-run

# Tear everything down
npm run destroy --env pr-11
npm run destroy --env pr-11 -- --dry-run
```

`--env pr-11` is the intended invocation. Current npm prints a harmless warning (`Unknown cli config "--env"`) and still forwards `pr-11` to the script. These are equivalent:

```bash
npm run deploy --env pr-11
npm run deploy --env=pr-11
PREVIEW_ENV=pr-11 npm run deploy
```

## Notes

- Staging is never deleted. `destroy` refuses names like `staging` / `production`.
- Auth Site URL on the preview project is pointed at the preview Worker URL so magic links work.
- Resend / Turnstile / Sentry secrets are copied from `.env.staging`. Preview sends real email if those keys are set.
- R2 copy runs in a short-lived helper Worker so objects never download through your laptop.
- Re-running `deploy` for the same env reuses the Supabase project, Hyperdrive, and R2 buckets, clears preview DB + R2, refreshes from staging, and redeploys Workers.

## CI (GitHub Actions)

Workflows under `.github/workflows/`:

| Workflow | Trigger | What runs |
| -------- | ------- | --------- |
| `ci.yml` | Push to any branch | `npm run typecheck`, `npm run lint`, `npm run test` |
| `pr-preview.yml` | Pull request opened, updated, reopened | Same quality checks → deploy → E2E → sticky PR comment |
| `pr-cleanup.yml` | Pull request closed | `npm run destroy --env pr-<number>` |

Preview env name: `pr-${{ github.event.pull_request.number }}` (e.g. `pr-42` → `https://insurance-app-pr-42.zhex900.workers.dev`).

### Required repository secrets

Configure in **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
| ------ | ------- |
| `STAGING_ENV_FILE` | Full contents of `.env.staging` (same as local staging deploy) |
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy/destroy ([API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) with Workers + R2 + Hyperdrive edit) |

`STAGING_ENV_FILE` must include at least `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `SUPABASE_ACCESS_TOKEN` for preview provisioning. See `.env.staging.example`.

Fork PRs skip deploy/E2E/destroy (no secrets on forks). Quality checks still run via `ci.yml`.
