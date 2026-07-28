# Testing

Unit, integration, and browser tests for BrokerSure (Phase 7).

## Commands

| Command                    | What                                             |
| -------------------------- | ------------------------------------------------ |
| `npm run test`             | Vitest unit + integration                        |
| `npm run test:unit`        | Unit only                                        |
| `npm run test:integration` | Integration only (skips if Postgres unreachable) |
| `npm run test:e2e`         | Playwright critical paths                        |
| `npm run test:smoke`       | Playwright smoke subset (post-deploy)            |
| `npm run typecheck`        | React Router typegen + `tsc`                     |

First-time Playwright: `npx playwright install chromium`

## Unit (Vitest)

Config: `vitest.config.ts`. Suites under `tests/unit/`:

- Adjustment formula + 25%/75% rules (`car-adjustment-calculator`)
- Zod client / user / adjustment schemas
- Document merge helpers
- Pagination helpers
- Roles + referral note helpers

## Integration

`tests/integration/` talks to local Supabase via `DATABASE_URL` (loads `.env`). If the DB is down, those tests **skip** rather than fail.

## E2E (Playwright)

Config: `playwright.config.ts` — `baseURL` from `E2E_BASE_URL` (default `http://127.0.0.1:5173`).

By default starts `npm run dev` unless the server is already up, or set `E2E_SKIP_WEBSERVER=1`.

Seeded demo users (`npm run db:seed`):

| Email               | Password      | Role   |
| ------------------- | ------------- | ------ |
| `broker@demo.local` | `password123` | broker |
| `admin@demo.local`  | `password123` | admin  |

Optional: `E2E_SUPER_ADMIN_EMAIL` / `E2E_SUPER_ADMIN_PASSWORD` for feature-flag toggle.

Resend is mocked in the email dialog path (`mockResendEmailApi`).

## Smoke

`npm run test:smoke` — login + clients + policies lists. Point `E2E_BASE_URL` at staging/prod for post-deploy checks; never use production credentials in git.
