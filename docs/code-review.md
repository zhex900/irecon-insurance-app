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
- [ ] Secure (authz, ownership, Zod, no secrets/PII)
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

- [ ] Auth + ownership on every touched loader/action/`api/*`
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

## Reviewer output (AI)

1. **Verdict:** Approve / Approve with nits / Request changes
2. **Blocking issues**
3. **Non-blocking nits**
4. **Residual risk** (what you did not fully verify)

Do not rubber-stamp large diffs — review by domain and say what was skipped.
