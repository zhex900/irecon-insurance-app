# Testing

Unit, integration, and browser tests for Irecon Insurance (Phase 7).

## Commands

| Command                    | What                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| `npm run test`             | Vitest unit + integration                                           |
| `npm run test:unit`        | Unit only                                                           |
| `npm run test:integration` | Integration only (skips if Postgres unreachable)                    |
| `pnpm run test:integration:policy-number-sql` | Gap-fill allocation SQL vs Postgres (required in CI)     |
| `npm run test:e2e`         | Playwright critical paths (starts `npm run dev`)                    |
| `npm run test:e2e:local`   | Same, against an already-running `localhost:5173` (skips webServer) |
| `npm run test:e2e:ui`      | Same as `test:e2e:local` but opens Playwright's `--ui` mode         |
| `npm run test:smoke`       | Playwright smoke subset (post-deploy)                               |
| `npm run typecheck`        | React Router typegen + `tsc`                                        |

First-time Playwright: `npx playwright install chromium`

## Unit (Vitest)

Config: `vitest.config.ts`. Suites under `tests/unit/`:

- Adjustment formula + 25%/75% rules (`car-adjustment-calculator`)
- Zod client / user / adjustment schemas
- Document merge helpers
- Pagination helpers
- Roles + referral note helpers

## Integration

`tests/integration/` talks to local Supabase via `DATABASE_URL` (loads `.env`). If the DB is down, those tests **skip** locally; in **CI** they **fail** if Postgres is unreachable after `scripts/ci/supabase-setup.mjs`.

Policy number gap-fill SQL: [`tests/integration/policy-number-allocation-sql.test.ts`](../../tests/integration/policy-number-allocation-sql.test.ts) — also run explicitly via `pnpm run test:integration:policy-number-sql` in GitHub Actions.

## CI database

GitHub Actions starts local Supabase in Docker before tests:

1. `node scripts/ci/supabase-setup.mjs` — `supabase start`, `db reset` (migrations + SQL seeds)
2. Vitest runs with the exported `DATABASE_URL` / Supabase keys

Reproduce locally: `npm run ci:db && npm run test`

Full JSON seed (`npm run db:seed`) is separate — not run in CI until seed data matches the UUID schema.

## E2E (Playwright)

Config: `playwright.config.ts` — `baseURL` from `E2E_BASE_URL` (default `http://127.0.0.1:5173`).

By default starts `npm run dev` unless the server is already up, or set `E2E_SKIP_WEBSERVER=1`.

**Authentication:** `tests/e2e/auth.setup.ts` logs in once per role and saves cookies to `playwright/.auth/` (gitignored). The `e2e` and `smoke` projects reuse `broker.json` via `storageState` — individual tests should not call `loginAs` unless they exercise login itself (`auth.spec.ts`). Re-run setup when sessions expire: `npx playwright test --project=setup`.

**UI mode:** `npm run test:e2e:ui` opens all projects. Ensure **e2e** (and **setup** if auth files are missing) are checked in the project filter in the toolbar. Run setup once if `playwright/.auth/broker.json` is absent. Override target: `E2E_BASE_URL=https://pr-7.irecon.net npm run test:e2e:ui`.

Seeded demo users (`npm run db:seed`):

| Email               | Password      | Role   |
| ------------------- | ------------- | ------ |
| `broker@demo.local` | `password123` | broker |
| `admin@demo.local`  | `password123` | admin  |

Optional: `E2E_SUPER_ADMIN_EMAIL` / `E2E_SUPER_ADMIN_PASSWORD` for feature-flag toggle.

Resend is mocked in the email dialog path (`mockResendEmailApi`).

## Smoke

`npm run test:smoke` — login + clients + policies lists. Point `E2E_BASE_URL` at UAT/prod for post-deploy checks; never use production credentials in git.

## Full E2E coverage plan

| Plan                                                   | Scope                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [e2e-test-plan.md](e2e-test-plan.md)                   | Route × role matrix, settings/reports gaps, phased rollout                                       |
| [e2e-policy-matrix-plan.md](e2e-policy-matrix-plan.md) | **Policy critical paths**: cover type × status (9 combos), scenario modules, premium + documents |

Scenarios: `tests/e2e/scenarios/policy-matrix/` (TypeScript modules per terminal state, shared expected values in `annual-shared.ts`).
