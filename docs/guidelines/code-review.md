# Code review

Run this **before finishing** every change (AI or human). Cite files/lines for failures.

Standards: [AGENTS.md](../AGENTS.md) · [architecture.md](architecture.md) · [coding-standards.md](coding-standards.md) · [design-patterns.md](design-patterns.md) · [performance.md](performance.md) · [ui-guidelines.md](ui-guidelines.md)

Authz, secrets, or data-loss fails **block** merge.

## Before finishing

- [ ] Types are correct (`npm run typecheck`)
- [ ] No duplicated logic
- [ ] No dead code
- [ ] No lingering TODOs in the diff (or tracked as explicit follow-up)
- [ ] No `console.log`
- [ ] No commented-out code
- [ ] Naming is clear and matches neighbors
- [ ] Errors handled (typed domain errors → form/HTTP)
- [ ] Accessible (label, description, error, keyboard, focus)
- [ ] Responsive where the surface needs it
- [ ] Secure (authz, documented product scope, Zod, no secrets/PII)
- [ ] Tested or residual risk stated
- [ ] Documentation updated if public behavior/API changed

## Architecture & layering

- [ ] Routes only coordinate; services own rules; components only render
- [ ] Loaders do not mutate / email / write
- [ ] Actions own mutations; `api/*` returns JSON only
- [ ] Services import neither React nor React Router
- [ ] DB rows mapped to DTOs before UI
- [ ] Complexity limits respected (or file split on touch): fn ≤50, component ≤300, file ≤500, nest ≤3, params ≤4
- [ ] No new unnecessary abstractions; prefer deletion

## Security & data

- [ ] Auth + documented product scope/role on every touched loader/action/`api/*`
- [ ] Every input validated; client never trusted
- [ ] No raw SQL with string concat; parameterized/Drizzle only
- [ ] No secrets, tokens, or PII in logs/diff
- [ ] No `_archive/` imports into the app
- [ ] URLs unchanged unless intentional + `routes.ts` updated

## React & UI

- [ ] No `useEffect` fetch; no derived state via `useEffect`
- [ ] Immutable state/prop updates
- [ ] shadcn/ReUI + Field forms + semantic tokens
- [ ] Color not the only status indicator
- [ ] Dialogs have titles; unfinished UI flagged

## Bundle & Workers

- [ ] No new static `@pdfme/generator` / `@pdfme/ui` / TipTap imports in `app/routes/**`
- [ ] PDF/Designer loaded via dynamic `import()` (or existing client-only path)
- [ ] Light helpers not pulled from heavy modules (e.g. cache invalidate ≠ `generate.ts`)
- [ ] Loaders don’t embed full multi-version template JSON; large payloads on demand
- [ ] New browser-only packages listed in `vite.stub-client-only.ts` when needed
- [ ] **DB loaders:** ≤3 parallel `getDb()` queries per loader/action (waves or combined SQL); list pages with facet counts use async secondary (`api/*` + `useFetcher`) when > ~4 total queries — see [performance.md](../architecture/performance.md) § Async list loading

## Reviewer output (AI)

1. **Verdict:** Approve / Approve with nits / Request changes
2. **Blocking issues**
3. **Non-blocking nits**
4. **Residual risk** (what you did not fully verify)

Do not rubber-stamp large diffs — review by domain and say what was skipped.
