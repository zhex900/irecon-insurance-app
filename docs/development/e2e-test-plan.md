# E2E Test Plan — Full Coverage (Playwright)

Companion to [docs/development/testing.md](testing.md). That doc explains _how to run_ tests; this one defines _what "full coverage" means_ for Playwright E2E and tracks the work to get there.

## 1. What "100% coverage" means here

Statement/branch coverage is a **unit/integration** concern, not an E2E one. Driving a full browser through every `if` branch is slow, flaky, and duplicates cheaper Vitest tests. So this plan splits the goal in two, per the repo's existing split ([docs/development/testing.md](testing.md)):

| Layer              | Owns                                                                                                                                                                      | Tool                                                    | Target                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit / integration | Business logic, calculators, mappers, services, Zod schemas                                                                                                               | Vitest (`@vitest/coverage-v8`, already a devDependency) | Statement/branch coverage thresholds (see §7)                                                                                                  |
| E2E (this plan)    | Every route is reachable, every role sees the right thing, every primary user workflow completes, every documented product rule is exercised through the UI at least once | Playwright                                              | **Requirement coverage**: 100% of the route × role matrix (§4) and the critical-workflow list (§5) have a passing spec, not 100% of code lines |

"Full E2E coverage" in this doc = every row in the matrices below has at least one Playwright test, plus the cross-cutting concerns in §6. Deep edge-case permutations (every validation message, every pricing formula variant) stay in Vitest ([docs/pricing/car-premium-formulas.md](pricing/car-premium-formulas.md) already has dedicated unit suites for those).

## 2. Current state (baseline)

Config: [playwright.config.ts](../playwright.config.ts) — `e2e` project (all `*.spec.ts` except smoke) + `smoke` project. Helpers: [e2e/helpers/auth.ts](../e2e/helpers/auth.ts) (`loginAs`, `logout`, `mockResendEmailApi`).

Existing specs:

| File                            | Covers                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `e2e/auth.spec.ts`              | Login, logout, unauthenticated redirect, invalid credentials                    |
| `e2e/clients.spec.ts`           | Create client draft → save → appears in list                                    |
| `e2e/policy.spec.ts`            | Policies list filters/badges, email-documents dialog validation (Resend mocked) |
| `e2e/policy-matrix.spec.ts`     | Annual policy matrix: create → premium → documents → taken / not taken          |
| `e2e/pagination.spec.ts`        | `page`/`pageSize` query params on clients + policies lists                      |
| `e2e/settings-features.spec.ts` | Broker/admin blocked from `/settings/features`                                  |
| `e2e/smoke.spec.ts`             | Post-deploy: login + open clients + open policies                               |

**Gap**: everything in `/settings/*` except `features` (ar-brokers, account-managers, car-wording, users, email-templates, document-templates, library-documents, prices, audit-log), `/reports/*` exports, `/profile`, `/dashboard`, policy detail deep flows (status transitions, document generation, adjustment save), client detail, global search, recent-routes/sidebar persistence, 404/error boundary, and the full RBAC × feature-flag matrix (§6.1).

## 3. Conventions for new specs

- One `describe` per domain, file name matches domain (`e2e/<domain>.spec.ts`), mirrors existing files.
- Always go through `loginAs(page, demoUsers.<role>)` from `e2e/helpers/auth.ts` — never re-implement login.
- Mock outbound side effects the same way `mockResendEmailApi` does (`page.route`) — never send real email, never call real Resend/Turnstile/Sentry in CI.
- Unique, timestamped test data (`E2E Client ${Date.now()}`) so specs are idempotent against a shared/UAT DB and safe to re-run without cleanup.
- Prefer `getByRole`/`getByLabel` (accessible queries) over CSS selectors, consistent with existing specs and [docs/guidelines/ui-guidelines.md](ui-guidelines.md) a11y requirements.
- New fixtures (roles, mocks) go in `e2e/helpers/`, not inline per-spec, so they're reused (see §8).
- Downloads (xlsx exports): use Playwright's `page.waitForEvent("download")`, assert filename/size, don't assert on binary content in E2E (leave cell-level correctness to `tests/unit/premium-excel.test.ts` style unit tests).
- File uploads (library docs, avatars, email footer image): `locator.setInputFiles()` with a small fixture file committed under `e2e/fixtures/`.

## 4. Route × role coverage matrix

Roles: `broker`, `admin`, `super-admin` ([app/lib/auth/roles.ts](../app/lib/auth/roles.ts)). Source of truth for the route list: [app/routes.ts](../app/routes.ts).

### 4.1 Public / unauthenticated

| Route                         | Scenario                                                                                | Status                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `/login`                      | Valid login (all 3 roles), invalid credentials, Turnstile present                       | Login covered (broker only) — add admin/super-admin login smoke |
| `/logout`                     | Clears session, redirects to `/login`                                                   | Covered                                                         |
| `/forgot-password`            | Submit known/unknown email, confirmation message                                        | **Missing**                                                     |
| `/reset-password`             | Valid token flow (or documented as untestable without a real email link — see §9 risks) | **Missing**                                                     |
| `/auth/confirm`               | Supabase confirm redirect handling                                                      | **Missing** (low priority — mostly Supabase-hosted)             |
| `/` (index)                   | Redirects appropriately when authenticated vs not                                       | **Missing**                                                     |
| Unknown path (`routes/$.tsx`) | 404 / catch-all renders, doesn't 500                                                    | **Missing**                                                     |

### 4.2 Core app shell

| Route                        | Scenario                                                                              | Status      |
| ---------------------------- | ------------------------------------------------------------------------------------- | ----------- |
| `/dashboard`                 | Loads for each role, key widgets render                                               | **Missing** |
| `/profile`                   | View own profile, update fields, change avatar upload                                 | **Missing** |
| Sidebar / nav                | Recent routes persist across reload, role-based links appear/disappear (ties to §6.1) | **Missing** |
| Global search (`api/search`) | Search clients + policies from nav search, result navigates correctly                 | **Missing** |

### 4.3 Clients

| Route                     | Scenario                                               | Status                                          |
| ------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| `/clients`                | List, filter, search, empty state                      | Pagination only — add filter/search/empty-state |
| `/clients/new`            | Draft create → save → appears in list                  | Covered (happy path only)                       |
| `/clients/:clientId/edit` | Edit existing client, validation errors, discard draft | **Missing**                                     |
| `/clients/:clientId`      | Detail view, related policies list, notes              | **Missing**                                     |

### 4.4 Policies

| Route                        | Scenario                                                                                                                                      | Status                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `/policies`                  | List, filters, bulk actions (`PolicyListBulkBar`), empty state                                                                                | Pagination + list heading only              |
| `/policies/new`              | Full wizard: pick client → cover type → premium calc → save as Pending                                                                        | **Missing** (only "link exists" is covered) |
| `/policies/:policyId`        | Detail: premium summary, status transitions (Pending → Taken → Not taken), document generation, email documents (mocked), audit trail visible | Email-dialog validation only                |
| `/policies/:policyId/adjust` | Full adjustment save flow (25%/75% rule), not just "link exists"                                                                              | Entry point only                            |

### 4.5 Reports

| Route                                                     | Scenario                                     | Status      |
| --------------------------------------------------------- | -------------------------------------------- | ----------- |
| `/reports`                                                | Index renders links                          | **Missing** |
| `/reports/car-policies` + `api/reports/car-policies.xlsx` | Filter, trigger export, download event fires | **Missing** |
| `/reports/car-renewals` + `api/reports/car-renewals.xlsx` | Filter, trigger export, download event fires | **Missing** |

### 4.6 Settings

| Route                                            | Broker                | Admin                                                        | Super-admin                                                           | Status      |
| ------------------------------------------------ | --------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- | ----------- |
| `/settings` (index)                              | Sees limited links    | Sees admin links                                             | Sees all links                                                        | **Missing** |
| `/settings/ar-brokers`                           | Blocked               | CRUD                                                         | CRUD                                                                  | **Missing** |
| `/settings/account-managers`                     | Blocked               | CRUD (flag-gated, §6.1)                                      | CRUD                                                                  | **Missing** |
| `/settings/car-wording`                          | Blocked               | CRUD (flag: `additional_wording`)                            | CRUD                                                                  | **Missing** |
| `/settings/users`                                | Blocked               | List/manage (scope TBD — confirm admin can manage users)     | Full CRUD incl. disable/delete                                        | **Missing** |
| `/settings/email-templates` + `/:key`            | Blocked               | Edit (flag: `email_templates`)                               | Edit                                                                  | **Missing** |
| `/settings/document-templates` + `/:templateKey` | Blocked               | Edit (flag: `document_templates`, pdfme Designer — see §6.3) | Edit                                                                  | **Missing** |
| `/settings/features`                             | Blocked → `/settings` | Blocked → `/settings`                                        | Toggle flags                                                          | Covered     |
| `/settings/library-documents`                    | Blocked               | Upload/label/delete (flag: `library_documents`)              | Upload/label/delete                                                   | **Missing** |
| `/settings/prices` + `/:catalogue[/new\|/:id]`   | Blocked               | CRUD (flag: `prices`)                                        | CRUD                                                                  | **Missing** |
| `/settings/audit-log`                            | Blocked               | View (flag: `audit_log`)                                     | View                                                                  | **Missing** |
| `/settings/sentry-test`                          | N/A                   | N/A                                                          | Manual/dev-only trigger — low priority, consider excluding from suite | Not planned |

### 4.7 `api/*` routes

These return JSON only and are primarily exercised **indirectly** through the UI flows above (draft autosave, document generation/email, avatars, library docs, recent routes, audit, search, xlsx exports). No direct E2E specs against `api/*` are planned; contract-level checks belong in integration tests (see `tests/integration/services.test.ts` and `tests/unit/document-worker-contract.test.ts`, `tests/unit/api-search.test.ts`, `tests/unit/http-boundaries.test.ts` for the existing pattern) — call this out explicitly so nobody duplicates effort in Playwright.

## 5. Critical end-to-end workflows (beyond single routes)

These are the "start to finish" journeys the plan's original overview asked for — each spans multiple routes:

1. **Quote-to-Taken / policy matrix**: new client → new policy (Pending) → premium calc → generate documents → email documents (Resend mocked) → mark Taken / Not taken. Full **3 cover types × 3 statuses** matrix with static JSON fixtures: [e2e-policy-matrix-plan.md](e2e-policy-matrix-plan.md). Existing smoke: `policy-flow-quote-to-taken.spec.ts`.
2. **Adjustment**: existing Taken policy → adjust → recalculate premium → save → verify new premium totals + audit trail.
3. **Client lifecycle**: create → edit → view linked policies → (if delete exists) delete, confirming referential UI updates.
4. **Document template publish**: super-admin edits a document template → publishes → confirms the published version is what a policy document generation uses (ties into worker-bundle rule: Designer must load via dynamic import, not break SSR — flag as a manual bundle-size check in CI, not a Playwright assertion).
5. **Feature flag toggle propagation**: super-admin disables a flag → admin loses the nav link and gets redirected on direct navigation → super-admin still has access → re-enable to avoid leaving env dirty (existing pattern in `settings-features.spec.ts`, extend to all 7 flags).
6. **Report export**: filter a report → download xlsx → assert file arrives (not its contents).
7. **Session timeout**: idle past timeout → next action redirects to `/login` (complements `tests/unit/session-timeout.test.ts`, which tests the timer logic in isolation — E2E confirms the UI actually redirects).

## 6. Cross-cutting concerns

### 6.1 RBAC × feature-flag matrix

Flags from [app/lib/services/feature-flags.ts](../app/lib/services/feature-flags.ts): `audit_log`, `prices`, `email_templates`, `library_documents`, `document_templates`, `additional_wording`, `account_managers`. All default **enabled**; when disabled they're hidden from everyone except `super-admin` ([side-nav.service.ts](../app/lib/services/navigation/side-nav.service.ts)).

Add one parametrized spec (`e2e/feature-flags-matrix.spec.ts`) that, for each flag: toggles off as super-admin → asserts admin nav link disappears + direct nav redirects → asserts super-admin still has access → toggles back on. This generalizes the existing single-flag test in `settings-features.spec.ts`.

### 6.2 Auth & session edge cases

Unauthenticated access to every `/settings/*` and `/policies|clients|reports*` route → redirect to `/login` (currently only asserted for `/clients`). Cover with a small loop over the route list rather than one test per route.

### 6.3 Heavy client-only bundles (pdfme / TipTap)

Per [.cursor/rules/worker-bundle.mdc](../.cursor/rules/worker-bundle.mdc), the Document Template editor (pdfme Designer) and email template editor (TipTap/react-email) are dynamically imported client-side. E2E specs for these routes must:

- Wait for the editor's mount marker (not just `page.goto`) before interacting — dynamic import adds latency.
- Treat these as **smoke-level** specs (editor loads, toolbar renders, save/publish button works) rather than deep canvas-interaction tests — deep pdfme/TipTap interaction is brittle in headless Chromium and low ROI; note this explicitly as an accepted scope limit rather than silently skipping it.

### 6.4 Downloads, uploads, email

- Downloads: `page.waitForEvent("download")`, assert suggested filename pattern (`car-policies*.xlsx`) and non-zero size.
- Uploads: small fixture files under `e2e/fixtures/` (e.g. a 1x1 PNG for avatars/email footer, a tiny PDF for library documents).
- Email: extend the `mockResendEmailApi` pattern to any other Resend call sites; never depend on a real inbox.

### 6.5 Data seeding & isolation

E2E relies on `npm run db:seed` demo users (`broker@demo.local`, `admin@demo.local`). Policy depth (create → premium → documents → status) is covered by `policy-matrix.spec.ts`; list/email smoke by `policy.spec.ts`.

## 7. Phased rollout

| Phase    | Scope                                                                                                                                                        | Notes                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 0 (done) | Auth, clients happy path, policies entry points, pagination, one feature flag                                                                                | Baseline in repo today                                                       |
| 1        | Deterministic seed fixture (§6.5) so skip-prone specs always execute                                                                                         | Unblocks everything below                                                    |
| 2        | Settings CRUD specs: ar-brokers, account-managers, users, prices, library-documents, car-wording, email-templates, document-templates (smoke-level per §6.3) | One spec file per domain                                                     |
| 3        | Full RBAC × feature-flag matrix (§6.1), unauthenticated-redirect loop (§6.2)                                                                                 | Parametrized, low file count, high scenario count                            |
| 4        | Critical multi-route workflows (§5): quote-to-taken, adjustment, document publish→generate                                                                   | Highest business value, highest flake risk — budget extra stabilization time |
| 5        | Reports/exports, dashboard, profile, global search, sidebar/recent-routes persistence, 404                                                                   | Rounds out remaining routes                                                  |
| 6        | CI coverage dashboard: publish the route × role matrix (§4) as a checklist artifact per run so gaps are visible, not just "tests passed"                     | Optional but recommended for "100% coverage" claims to stay honest over time |

## 8. New fixtures/helpers needed

- `e2e/fixtures/` — small binary fixtures for upload tests (avatar PNG, library-doc PDF, email-footer image).
- Extend `e2e/helpers/auth.ts` with a `loginAsAny(role)` convenience if the per-role login pattern repeats a lot across new specs (only add if duplication actually shows up — don't pre-abstract, per [AGENTS.md](../AGENTS.md) "prefer deletion over adding abstractions").

## 9. Risks / open questions

- `/reset-password` and `/auth/confirm` depend on real email links from Supabase — likely need either a Supabase admin API call to mint a valid token in test setup, or should be explicitly marked as **not covered by E2E, covered by manual QA** rather than faked. Needs a decision before Phase 5.
- `/settings/sentry-test` looks like a dev-only Sentry trigger page — confirm it's not a real user-facing feature before deciding whether to test it at all.
- Document generation (pdfme) and Excel export are the slowest, most flake-prone specs — isolate them in their own file(s) so retries/timeouts don't slow down the rest of the suite.
- Confirm whether `admin` can manage `/settings/users` fully or if some actions (disable/delete, role assignment) are `super-admin`-only — the matrix in §4.6 has a "scope TBD" flag on this row; resolve against [app/lib/services/users/service.ts](../app/lib/services/users/service.ts) before writing that spec.

## 10. Definition of done

- Every row in §4's tables is either "Covered" or explicitly "Not planned" with a stated reason (no silent gaps).
- Every workflow in §5 has a passing spec.
- `npm run test:e2e` is green in CI on every PR; `npm run test:smoke` gates post-deploy.
- No spec depends on real third-party network calls (Resend, Turnstile, Sentry) — all mocked per §6.4.
- Vitest coverage thresholds (statement/branch) are configured and enforced separately per §1 — this doc does not claim E2E replaces that.
