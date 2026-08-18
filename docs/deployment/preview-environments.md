# Preview environments (per-PR)

Spin up an isolated copy of UAT on Cloudflare Workers with a Supabase **branch** off the UAT project, then tear it down.

```bash
npm run deploy --env pr-11
npm run destroy --env pr-11
```

`npm run deploy` with no `--env` (or `--env uat`) deploys UAT to `https://uat.irecon.net`.

## What gets created

| Resource             | Name pattern (example `pr-11`)                          |
| -------------------- | ------------------------------------------------------- |
| App Worker           | `insurance-app-pr-11` → `https://pr-11.irecon.net`      |
| PDF Worker           | `insurance-pdf-worker-pr-11` (private, service binding) |
| Excel Worker         | `insurance-excel-worker-pr-11`                          |
| R2 avatars           | `insurance-app-avatars-pr-11` (objects copied from UAT) |
| R2 library documents | `insurance-app-library-documents-pr-11` (from UAT)      |
| Hyperdrive           | `insurance-app-pr-11` → preview Postgres                |
| Supabase             | Branch `pr-11` off the UAT project (not a new project)  |

Generated wrangler configs and branch DB password live in `.preview-envs/<env>/` (gitignored).

## Environment names

Use any label you like (branch name, ticket id, `pr-11`, etc.). Rules:

- Not empty; max 128 characters
- Not reserved: `uat`, `production`, `prod`, `local`, `development`, `dev`, `excel`, `pdf`
- No path separators (`/`, `\`, `:`)

PR numbers map to `https://pr-<number>.irecon.net`. Other slugs fall back to `*.workers.dev`.

```bash
npm run deploy --env pr-11
npm run deploy --env=pr-11
PREVIEW_ENV=pr-11 npm run deploy
```

## Prerequisites

- Wrangler logged in (`npx wrangler login`) or `CLOUDFLARE_API_TOKEN`
- `.env.uat` filled in (same file as UAT deploys)
- `SUPABASE_ACCESS_TOKEN` in `.env.uat` ([personal access token](https://supabase.com/dashboard/account/tokens))
- `SUPABASE_ORG_ID` if the token can see more than one org (`npx supabase orgs list`)
- Docker (optional; only if using legacy dump/restore paths)

**Sentry and Resend** use the same keys as UAT/production — configure once in `.env.uat`.

Preview branches count against your Supabase org branching quota. Destroy them when the PR is done.

## Commands

```bash
# Deploy (creates infra on first run; reuses branch/Hyperdrive/R2 after)
npm run deploy --env pr-11

# Redeploy: refreshes R2 from UAT, redeploys Workers (branch reused)
npm run deploy --env pr-11

# Code-only redeploy (skip R2 copy)
npm run deploy --env pr-11 -- --skip-db --skip-r2

# Print names without creating anything
npm run deploy --env pr-11 -- --dry-run

# Tear everything down
npm run destroy --env pr-11
npm run destroy --env pr-11 -- --dry-run
```

## Notes

- UAT is never deleted. `destroy` refuses names like `uat` / `production`.
- Auth Site URL on the branch project is pointed at the preview URL so magic links work.
- Resend / Turnstile / Sentry secrets are copied from `.env.uat`. Preview sends real email if those keys are set.
- R2 copy runs in a short-lived helper Worker so objects never download through your laptop.
- PR database branches are created with `with_data: true` by default (UAT data). Set `PREVIEW_BRANCH_WITH_DATA=false` to skip data clone.

## CI (GitHub Actions)

Workflows under `.github/workflows/`:

| Workflow         | Trigger                                | What runs                                           |
| ---------------- | -------------------------------------- | --------------------------------------------------- |
| `ci.yml`         | Push to any branch                     | `npm run typecheck`, `npm run lint`, `npm run test` |
| `pr-preview.yml` | Pull request opened, updated, reopened | Quality checks → deploy → E2E → sticky PR comment   |
| `pr-cleanup.yml` | Pull request closed                    | `npm run destroy --env pr-<number>`                 |

Preview env name: `pr-${{ github.event.pull_request.number }}` (e.g. `pr-42` → `https://pr-42.irecon.net`).

### Required repository secrets

Configure in **Settings → Secrets and variables → Actions**:

| Secret                 | Purpose                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UAT_ENV_FILE`         | Full contents of `.env.uat` (same as local UAT deploy)                                                                                                  |
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy/destroy ([API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) with Workers + R2 + Hyperdrive edit) |

`UAT_ENV_FILE` must include at least `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `SUPABASE_ACCESS_TOKEN` for preview provisioning. See `.env.uat.example`.

Fork PRs skip deploy/E2E/destroy (no secrets on forks). Quality checks still run via `ci.yml`.

See also [domain.md](../domain.md) for hostname and DNS setup.
