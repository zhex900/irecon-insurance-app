# Refactor to production

Guide for taking this Irecon Insurance / CAR broker portal from a working prototype to a production-ready codebase and delivery pipeline.

Use this as the checklist and decision log. Prefer **small, mergeable PRs** over one big-bang move. Each phase should leave `main` deployable.

---

## Goals

1. **App-first repo** — production app at the project root; legacy, specs, and scratch material out of the way.
2. **Clear domains** — code organised by business area, not by “wherever it fit when we built it”.
3. **Hygiene** — smaller modules, no dead/duplicate code, consistent patterns, UI quality bar.
4. **Real data** — runtime data from Postgres; JSON only for seeds/fixtures/templates where justified.
5. **Real email** — Resend (or chosen provider) for transactional and document emails.
6. **Confidence** — lint/format, unit/domain tests, Playwright e2e, smoke tests.
7. **Safe delivery** — PR preview DB + e2e, staging on merge, prod on tag/release.

---

## Current snapshot (baseline)

| Area    | Today                                                                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App     | Lives under `web/` (React Router 8 + Cloudflare Workers)                                                                                                       |
| DB      | `supabase/` at repo root; Drizzle in `web/`                                                                                                                    |
| Legacy  | `legacy-app/`, MSSQL `script.sql`, CSVs, `car-pdf-templates/`                                                                                                  |
| Specs   | Many `CAR_*.md`, `DB_SCHEMA_CHANGELOG.md`, `questions.md` at root                                                                                              |
| Routes  | Folder tree `app/routes/{_auth,_app,api}/` + explicit `app/routes.ts` (URLs unchanged)                                                                         |
| Data    | `_archive/data/*.json` seeds only; `car_wording` from DB; `reference-data.ts` static lookups; document templates in Postgres (`app_document_template_version`) |
| Email   | Resend for policy document send; Supabase Auth for password reset/invite emails                                                                                |
| Quality | Vitest + Playwright; ESLint/Prettier/`npm run verify` (CI still Phase 9)                                                                                       |
| Deploy  | Manual staging script (`npm run deploy:staging`); no PR/prod automation                                                                                        |

Large files (all under ~500-line gate after Phase 3 follow-ups):

- Domain services live under `app/lib/services/{clients,policy,price,users,…}/`
- CAR wizard lives under `app/components/policies/wizard/` (shell ≤500)

---

## Principles (do not skip)

1. **One concern per PR** — e.g. “move routes into folders” is not mixed with “add Resend”.
2. **Keep** `main` **green** — every phase ends with typecheck + existing smoke path working.
3. **Migrate before delete** — move data to DB / seeds first; remove JSON only when nothing imports it.
4. **URL stability** — folder-based routes must keep the same public paths.
5. **Secrets never in git** — env examples only; CI uses GitHub/Cloudflare/Supabase secrets.
6. **Production data is sacred** — no private customer dumps in repo; UAT/staging use anonymised or synthetic data.
7. **Prefer boring** — industry defaults over clever one-offs.

---

## Target repository layout

After reorganisation (names can vary; structure should not):

```text
/
├── README.md                 # how to run the app (prod-facing)
├── package.json              # app package (moved from web/)
├── app/                      # React Router app (was web/app)
├── public/
├── workers/                  # Cloudflare worker entry if needed
├── supabase/                 # migrations, seed, config (stay near app)
├── scripts/                  # app ops: seed, deploy, migrate
├── e2e/                      # Playwright
├── .github/workflows/
├── docs/                     # living product/tech docs (curated)
│   └── REFACTOR_TO_PRODUCTION.md  # this file
└── _archive/                 # non-app bulk (not deployed)
    ├── legacy-app/
    ├── mssql/                # script.sql, .env.mssql.example, export scripts
    ├── specs/                # CAR_*.md, Phase 1 SOW, db.txt*
    ├── seeds-source/         # Client.csv, WholesaleBroker.csv, etc.
    ├── car-pdf-templates/    # source PDFs before convert (if not in app)
    └── notes/
```

### Rules for `_archive/`

- Not imported by the app.
- Not part of Cloudflare deploy artifact.
- OK to keep for historical reference; do not treat as source of truth.
- Optionally later: git-subtree or separate repo if size hurts clone times (`script.sql` is huge).

---

## Phased plan

### Phase 0 — Prep (1–2 days)

**Outcome:** Safe starting point; agreement on conventions.

- [x] Freeze a short “definition of done for production” (below).
- [x] Inventory secrets and environments: local / PR / staging / prod.
- [x] List every `~/data/*` import and classify: **runtime** | **seed** | **delete**. (Done: moved off `app/data`; seeds under `_archive/data`.)
- [x] Curate `docs/`; link this plan from root README.
- [x] Decide package manager lockfile policy (keep npm unless team wants pnpm).
- [x] Create GitHub project/board columns matching phases.

**DoD for “production-ready” (suggested):**

- App root layout as above.
- No private PII in repo.
- ESLint + Prettier + typecheck on every PR.
- Playwright smoke + critical path e2e on PR (against ephemeral Supabase).
- Staging auto-deploy on `main`; prod on semver tag.
- Resend live for broker/insurer document email + password flows as designed.
- Runtime reference data and prices from DB (or explicit, versioned seed tables)—not ad-hoc JSON reads in the request path.

---

### Phase 1 — Repo reorganisation

**Outcome:** App at root; noise in `_archive/`.

**Status: done (2026-07-28)**

- [x] Create `_archive/` and move non-app material
- [x] Hoist `web/` → repo root
- [x] Remove leftover `web/` directory
- [x] Fix npm scripts, seed/MSSQL/PDF paths, gitignore, tsconfig excludes
- [x] Update root README + `_archive/README.md`

Suggested order (historical):

1. **Create** `_archive/` and move non-app material first (low risk):

- `legacy-app/`, root `CAR_*.md`, `script.sql`, CSVs, `db.txt*`, `notes`, SOW docs, `questions.md`, MSSQL env examples.

1. **Hoist** `web/` **→ root**:

- Move app package files to `/`.
- Update paths in `wrangler.jsonc`, `drizzle.config.ts`, `react-router.config.ts`, Docker, scripts, agent skills, MCP configs.
- Keep `supabase/` at root (already correct); fix any `cd ..` assumptions in npm scripts.

1. **Update README** for new layout; fold old `web/README.md` into root README.
2. **Fix CI/local scripts** until `npm run dev`, `db:reset`, `typecheck`, `deploy:staging` work from root.

**Risks:** broken relative imports, Wrangler root, Supabase path, Cursor skills pointing at `web/`.

**Exit criteria:** Fresh clone → install → db reset → dev from repo root.

---

### Phase 2 — Routing structure (folder path routing)

**Outcome:** Routes grouped by domain; URLs unchanged.

**Status: done (2026-07-28)**

React Router framework mode already uses `routes.ts`. Prefer **explicit config + folder tree** (clearer than pure flat file conventions for this app size).

Current shape:

```text
app/routes/
  _auth/
    login.tsx
    logout.tsx
    forgot-password.tsx
    reset-password.tsx
    confirm.tsx
  _app/                    # layout route
    layout.tsx
    dashboard.tsx
    clients/
      _index.tsx
      new.tsx
      $clientId.tsx
      $clientId.edit.tsx
    policies/
      _index.tsx
      new.tsx
      $policyId.tsx
      $policyId.adjust.tsx
    reports/
      ...
    settings/
      _index.tsx
      users.tsx
      ar-brokers.tsx
      ...
      prices.tsx
      prices/
        ...
  api/
    policies.$policyId.draft.tsx
    ...
  _index.tsx
  $.tsx
  well-known.chrome-devtools.tsx
```

- [x] Update `app/routes.ts` module paths only — **URL strings unchanged**.
- [x] Keep API routes under `api/` with the same `/api/...` paths.
- [x] After move, regenerate types (`react-router typegen`) and fix `./+types/...` imports.
- [x] Remove or feature-flag `policies/ui-preview` for production builds (pre-existing).

**Exit criteria:** All existing URLs work; typegen clean.

---

### Phase 3 — Domain boundaries & file splits

**Outcome:** Logic grouped by domain; large files broken up.

**Status: done (2026-07-28)** — with noted exceptions below.

#### Domain services (under `app/lib/services/`)

| Domain                     | Module(s)                                                      |
| -------------------------- | -------------------------------------------------------------- |
| session / broker           | `broker-session.ts`, `auth/session.server.ts`                  |
| reference                  | `reference.service.ts`                                         |
| authorised representatives | `authorised-representative.service.ts`                         |
| users                      | `user.service.ts`                                              |
| clients                    | `client.service.ts`                                            |
| policies (CRUD)            | `policy-data.service.ts` (+ `policy.service.ts` orchestration) |
| dashboard                  | `dashboard.service.ts`                                         |
| other                      | existing pricing / list / report / audit / flags modules       |

`store.ts` is a **compatibility façade** (re-exports only). Call sites import domain modules.

#### UI splits completed

1. `car-policy-sections.tsx` → section modules + thin barrel
2. `car-policy-wizard.tsx` → hooks + step memory / form mapper
3. Settings users → `user-form-dialog`, `user-confirm-dialogs`, `users-table`

#### Consistency rules

- Server-only: `*.server.ts`. Browser-safe: `*.client.ts`.
- Named exports; default only for route modules.
- Prefer typed domain errors at new throw sites.

#### Size exceptions

Cleared — former follow-ups split into domain folders:

| Was                          | Now                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `list.service.ts`            | `clients/`, `policies/`, `users/`, `authorised-representatives/`, `search/`, `reports/` + `shared/list-query` |
| `price-catalogue.service.ts` | `price/*`                                                                                                     |
| `policy-documents.ts`        | `policy/documents/*`                                                                                          |
| wizard shell                 | `components/policies/wizard/` (shell ≤500)                                                                    |

**Exit criteria met:** hotspots split into domain folders; façades removed in Phase 4.

---

### Phase 4 — Dead code, duplicates, data layout

**Outcome:** Lean tree; DB is runtime source of truth.

**Status: done (2026-07-28)**

#### Data decision matrix

| File                                                                           | Status                                                                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `clients.json`, `policies.json`, `users.json`, `prices.json`, `reference.json` | Seed-only under `_archive/data/` — no runtime imports                                        |
| `authorised-representatives.json`                                              | Deleted (unused; AR from DB / CSV seed)                                                      |
| `car-wording.json`                                                             | Deleted from archive; runtime via DB `car_wording`                                           |
| `reference-data.ts`                                                            | Still static runtime lookups — migrate to DB tables over time                                |
| `pdf-templates/**` (historical)                                                | Removed from `app/assets/`; live pdfme layouts are DB-only (`app_document_template_version`) |

**Rule:** If the app reads it on every request, it belongs in Postgres (or KV/R2 for binaries), not JSON in the repo—except static PDF template layouts.

#### Hygiene sweep

- [x] Delete unused components/routes (`welcome/`, `ui-preview`, unused ReUI data-grid/filters/stepper + orphan UI primitives)
- [x] Delete unused deps (`@dnd-kit/*`, `@tanstack/react-table`, `@tanstack/react-virtual`)
- [x] Delete unused modules (`excluded-contracts.ts`, `store.ts` / `list.service.ts` façades, `policy-sidebar`, `EmptyState`)
- [x] Dedupe row mappers (`clients/normalize`, `users/normalize`, `authorised-representatives/normalize`)
- [x] Shared draft result type (`shared/draft-result.ts`); rename policy `PolicyDraftSaveResult`
- [x] Wire `getCarWording()` to Postgres `car_wording` (Drizzle schema + async loader)
- [x] `.gitignore`: `*.log`, `logs/`, `~$*`, OS junk

---

### Phase 5 — UI code quality

**Outcome:** Consistent UX and maintainable UI.

**Status: done (2026-07-28)**

- [x] Stick to **shadcn + ReUI**; do not invent parallel primitives.
- [x] Follow existing agent skills: Field/FieldGroup forms, semantic tokens, no one-off colour hacks.
- [x] Shared patterns: page header, empty states, tables + `TablePagination`, dialogs, toasts (`toast.success` on CRUD).
- [x] Accessibility: dialog titles (price schedule `Dialog`), label associations, `focusFormIssue` on client / user / AR / wizard forms.
- [x] Loading/disabled states via `LoadingButton` / Spinner—not ad-hoc opacity.
- [x] Responsive pass on list + wizard (pagination already wraps; verify).
- [x] Copy review: remove prototype wording (“CAR Broker Portal” → Irecon Insurance) consistently.
- [x] Feature-flag unfinished surfaces (settings modules via existing flags).

Optional: Storybook later—not required for v1 prod if Playwright covers critical UI.

---

### Phase 6 — Resend (email)

**Outcome:** Reliable transactional + document email.

**Status: done (2026-07-28)**

- [x] Env: `RESEND_API_KEY`, `EMAIL_FROM`, optional `EMAIL_REPLY_TO` (`.env.example`, staging secrets).
- [x] Implement `app/lib/services/email/resend.server.ts` (thin wrapper).
- [x] Wire document email dialog → `POST /api/policies/:policyId/email-documents` → Resend (PDF attachments; library docs from R2).
- [x] Password invite / reset: **Supabase Auth templates** (admin creates users with password; forgot/reset via `resetPasswordForEmail`). Document email delivery stays on Resend.
- [x] Persist send attempts in audit log (`policy.documents_email` after successful Resend).

---

### Phase 7 — Tests

**Outcome:** Automated confidence before humans look at PRs.

**Status: done (2026-07-28)** — scaffolding + unit goldens in place; deepen e2e as data allows.

#### Layers

| Layer       | Tool                              | What                                                  |
| ----------- | --------------------------------- | ----------------------------------------------------- |
| Static      | `tsc` (ESLint/Prettier → Phase 8) | Types                                                 |
| Unit        | Vitest                            | Zod schemas, pricing math, merge helpers, pure domain |
| Integration | Vitest + local/ephemeral DB       | Services against Postgres (skip if DB down)           |
| E2E         | Playwright                        | Critical user journeys                                |
| Smoke       | Playwright `smoke` project        | Prod/staging after deploy                             |

#### Playwright critical paths (minimum)

1. [x] Login / logout / forbidden redirect (`e2e/auth.spec.ts`).
2. [x] Create client → save → appear in list/search (`e2e/clients.spec.ts`).
3. [x] Policy entry from client / list (`e2e/policy.spec.ts` — Taken path soft-skips without data).
4. [x] Email dialog validation with Resend mocked (`e2e/policy.spec.ts`).
5. [x] Adjustment route when Taken policy exists (`e2e/policy.spec.ts`).
6. [x] Settings: features refuse for broker/admin; super-admin toggle when env set.
7. [x] Pagination + page size query params (`e2e/pagination.spec.ts`).

#### Conventions

- [x] `e2e/` at repo root; `playwright.config.ts` with `baseURL` from env.
- [x] Test users seeded per environment; never use prod credentials.
- [x] Prefer `getByRole` / label selectors over CSS class selectors.
- [x] Mock third parties (Resend) in e2e.

#### Unit first for pricing

- [x] Cover `calculateCarAdjustment` / `validateAdjustmentFinish` with fixtures aligned to `_archive/specs/CAR_PRICING_FORMULAS.md` (25% base refund cap, 75% floor).

See [docs/testing.md](testing.md).

---

### Phase 8 — Tooling: lint, format, hooks

**Outcome:** One command to verify quality.

**Status: done (2026-07-28)**

```bash
npm run lint          # ESLint (typescript-eslint + react-hooks)
npm run format        # Prettier write (+ Tailwind class sort)
npm run format:check
npm run typecheck
npm run test          # Vitest
npm run test:e2e      # Playwright
npm run verify        # lint + format:check + typecheck + unit
```

- [x] ESLint flat config; Prettier; editorconfig.
- [x] `lint-staged` + husky pre-commit.
- [x] CI must not rely on local hooks alone (documented; wire in Phase 9).
- [x] Tailwind class sorting via `prettier-plugin-tailwindcss`.

Note: TypeScript 7 + typescript-eslint uses side-by-side `@typescript/typescript6` — see [docs/tooling.md](tooling.md).

---

### Phase 9 — CI/CD & environments

**Outcome:** PR isolation, staging continuous, prod gated.

#### Environments

| Env        | App                                             | Database                          | Who              |
| ---------- | ----------------------------------------------- | --------------------------------- | ---------------- |
| Local      | `localhost`                                     | Local Supabase                    | Devs             |
| PR         | Cloudflare Workers preview **or** ephemeral URL | **New Supabase branch/DB per PR** | CI + reviewers   |
| Staging    | staging hostname                                | Staging Supabase project          | Auto on `main`   |
| Production | prod hostname                                   | Prod Supabase project             | Tag/release only |

#### Pipeline design

```text
PR opened / updated
  → lint + format:check + typecheck + unit
  → provision Supabase preview (branch) + migrate + seed synthetic data
  → deploy Workers preview (if used) OR run Playwright against preview URL
  → comment on PR: preview URL + e2e summary
  → on PR close: destroy preview DB/infra

merge to main
  → destroy PR infra (if still present)
  → deploy staging Worker
  → migrate staging DB (forward-only)
  → run full e2e against staging
  → notify (Slack/email) on failure; block “promote” if desired

tag vX.Y.Z / GitHub Release
  → deploy production Worker
  → migrate prod (reviewed migration only)
  → smoke Playwright (login, open client, open policy)
  → rollback plan documented (previous Worker version + DB migrate caution)
```

#### Implementation notes

- **Supabase:** use [Branching](https://supabase.com/docs/guides/platform/branching) or Management API to create DB per PR; store connection string in CI job env.
- **Cloudflare:** Workers preview deployments + wrangler; secrets via Cloudflare/GitHub OIDC where possible.
- **Migrations:** only `supabase/migrations` (or Drizzle-generated SQL committed); never `drizzle-kit push` in prod CI.
- **Seeds:** synthetic faker seed for PR/staging; **separate** controlled prod migration playbook for real broker data.
- **Comment trigger:** optional `ops/e2e` PR comment to re-run expensive suite.
- **Concurrency:** cancel older PR runs on the same PR.

#### Suggested workflows

- `.github/workflows/pr.yml` — quality + preview e2e
- `.github/workflows/staging.yml` — on push to `main`
- `.github/workflows/release.yml` — on tag `v*`
- `.github/workflows/pr-cleanup.yml` — on PR close

---

### Phase 10 — Data & go-live (from your notes)

- [ ] Test / UAT datasets: anonymised; no production PII in git or PR DBs.
- [ ] Prod data migration plan from legacy MSSQL (scripts live under `_archive/mssql`); dry-run on staging.
- [ ] Domain + email DNS (Resend + app hostname).
- [ ] PDF generation sign-off (ROA, Schedule) against golden PDFs.
- [ ] UI copy polish pass.
- [ ] Access control review (broker vs admin vs super-admin).
- [ ] Backup/restore drill for Supabase prod.
- [x] Monitoring: Cloudflare Observability + Sentry (errors, Session Replay, user interactions). See [observability.md](observability.md).

---

## Coding standards (recommended additions)

Living standards (preferred source of truth for day-to-day work):

- [AGENTS.md](../AGENTS.md)
- [architecture.md](architecture.md)
- [coding-standards.md](coding-standards.md)
- [design-patterns.md](design-patterns.md)
- [performance.md](performance.md)
- [ui-guidelines.md](ui-guidelines.md)
- [code-review.md](code-review.md)

Beyond those—industry defaults for this stack (keep in sync when promoting rules):

### TypeScript & architecture

- `"strict": true`; no new `any` (eslint `@typescript-eslint/no-explicit-any`).
- Prefer `unknown` + narrow at boundaries (FormData, JSON, third-party).
- Server/client boundary enforced by filename and import lint (`*.server.ts` never imported from client components).
- Validate all external input with Zod at the edge (actions, webhooks).
- Return Result-like types or typed errors from services; don’t throw raw strings.

### React

- React Router loaders/actions for server data; avoid ad-hoc `useEffect` fetching where a loader fits.
- Forms: RHF + Zod resolver; shared Field helpers.
- Don’t add `useMemo`/`useCallback` by default (React Compiler / team convention)—only for proven hot paths.
- Keys: stable ids, never array index for dynamic lists that reorder.

### Security

- CSRF: follow React Router / same-origin action practices; cookies `httpOnly`/`secure`/`sameSite`.
- Authz checks in **every** loader/action (not only UI hiding).
- R2/signed URLs short-lived; no public buckets for customer docs.
- Dependency audit in CI (`npm audit` policy or Dependabot).
- Rate-limit auth and email send endpoints.

### Database

- Migrations forward-only; expand/contract for breaking changes.
- Explicit transactions for multi-table writes (policy + car + documents).
- Indexes for list filters you actually use; verify with `explain` on slow queries.
- Soft-delete only if product requires it; otherwise hard delete + audit row.

### API & HTTP

- Consistent JSON error shape for `api/*` routes.
- Idempotent where retries happen (email send keys, document generate).

### Observability

- Structured logs (request id, user id, policy id)—no PII in logs beyond what compliance allows.
- Audit log for material mutations (already started—keep complete).

### Git & PR

- Conventional commits or clear prefixes: `feat:`, `fix:`, `refactor:`, `chore:`.
- Small PRs; description includes test plan.
- Required checks: `verify` + e2e before merge.
- No `--no-verify` in CI; no force-push to `main`.

### Docs

- Root README = runbook.
- `docs/` = ADRs for big choices (email provider, branching strategy, data migration).
- Update changelog / release notes on tag.

---

## Suggested PR sequence (execution order)

1. Archive non-app files → `_archive/`
2. Hoist `web/` to root + fix scripts
3. ESLint + Prettier + `verify` script + PR workflow (no e2e yet)
4. Folderise routes
5. Split largest form/service files (multiple PRs)
6. Migrate `reference` / wording from TS catalogues into DB tables
7. Resend integration + audit
8. Vitest pricing + domain tests
9. Playwright smoke locally
10. Supabase preview + PR e2e
11. Staging workflow on `main`
12. Release workflow + smoke
13. Prod data migration dry-run → go-live

---

## Open decisions (resolve early)

| Topic                      | Options                                              | Recommendation                                                         |
| -------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Monorepo vs single package | Keep single app package                              | Single package at root until a second app appears                      |
| Hosting                    | Cloudflare Workers (current)                         | Stay; aligns with existing wrangler                                    |
| Email                      | Resend vs Cloudflare Email                           | **Resend** for transactional + attachments ergonomics                  |
| PR app hosting             | Workers preview vs Playwright-only against ephemeral | Preview URL in PR comment if cost allows                               |
| Reference data             | DB tables vs versioned JSON seed                     | **DB tables** seeded in migrations/seeds                               |
| E2E on every commit        | Full vs smoke on PR, full on main                    | Smoke+critical on PR; full on `main`/nightly                           |
| Concurrent edit locking    | Row columns vs `edit_lock` lease table               | **Lease table** — see [edit-lock-leases.md](plans/edit-lock-leases.md) |

---

## Progress tracking

Copy into the project board; check off in PRs.

| Phase               | Status      | Owner | Notes                                    |
| ------------------- | ----------- | ----- | ---------------------------------------- |
| 0 Prep              | Done        |       | Decisions in this doc                    |
| 1 Repo layout       | Done        |       | App at root; `_archive/`                 |
| 2 Routes folders    | Done        |       | `_auth/`, `_app/`, `api/`                |
| 3 Domain splits     | Done        |       | store façade; wizard/sections/users      |
| 4 Dead code / data  | Done        |       | seeds archived; dead UI/deps removed     |
| 5 UI quality        | Done        |       | Irecon Insurance copy; Empty; a11y focus |
| 6 Resend            | Done        |       | document email API + Supabase auth mail  |
| 7 Tests             | Done        |       | Vitest unit/integration + Playwright     |
| 8 Lint/format       | Done        |       | ESLint + Prettier + husky + verify       |
| 9 CI/CD             | Not started |       |                                          |
| 10 Go-live data/DNS | Not started |       |                                          |

---

## Related product notes (from `notes`)

Still in scope for production polish (track as parallel workstreams):

- Generate ROA + Schedule (PDF) quality
- UI/text polish
- Domain / email domain
- Test/UAT data without private production dumps
- Prod migration from legacy

---

_Last updated: 2026-07-28. Update this doc when a phase completes or an open decision is closed._
