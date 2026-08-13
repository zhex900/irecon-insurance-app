# Current code review — 2026-08-12

## Verdict

**Approve.** Full-codebase review (routes, services, components) found **zero blocking issues** — no missing authz, no secrets/PII in logs, no SQL-injection risk, and zero Cloudflare Worker-bundle static-import violations. All 5 high-priority and effectively all medium/low findings from the review are resolved in this pass. Two items are intentionally deferred as documented debt (see below) rather than risked without dedicated test coverage.

## Scope and method

Four parallel read-only investigations across ~180 files, each checked against the repo's own standards docs:

- **Architecture & layering** (`docs/architecture.md`, `docs/design-patterns.md`) — routes vs. services boundaries, loader/action purity, error handling, server performance (56 route files + 67 service files).
- **Worker bundle compliance** (`.cursor/rules/worker-bundle.mdc`, `docs/performance.md`) — static vs. dynamic imports of `@pdfme/`*/TipTap, `vite.stub-client-only.ts` coverage, loader payload sizes.
- **UI composition, accessibility & Web Interface Guidelines** (`docs/ui-guidelines.md`, Vercel composition-patterns skill) — `app/components/`** domain components and route render bodies.
- **Code hygiene & complexity** (`docs/coding-standards.md`) — complexity limits, dead code, TypeScript strictness, naming/import conventions.

Findings were compiled into a canvas ([code-review-2026-08-12](/Users/jake/.cursor/projects/Users-jake-Code-irecon-insurance-app/canvases/code-review-2026-08-12.canvas.tsx)) with file:line citations, then fixed in two passes. Verified after every change with `npm run typecheck`, `npm run lint`, the Vitest unit + integration suites, and `prettier --check` on every touched file — not just at the end.

## What is working well

- **Authz discipline** — every loader/action/`api/`* route calls `requireAuth`; admin/super-admin-gated routes consistently enforce role + feature-flag checks, verified in both routes and the services they delegate to.
- **Worker bundle rule** — zero static top-level imports of `@pdfme/generator|ui|converter`, `@tiptap/*`, or `@react-email/editor` anywhere in `app/routes/`**; every restricted package is dynamic-import-only or covered by `CLIENT_ONLY_PREFIXES`.
- **SQL safety** — every `sql\usage interpolates via Drizzle's parameterized`${}` syntax; no string-built SQL with user input.
- **TypeScript strictness** — `any` usage is effectively zero outside one vendored, lint-disabled ReUI file (`app/components/reui/tree.tsx`); no `enum`/`namespace`, no commented-out code, no `TODO`/`FIXME` anywhere in `app/`.
- **Accessibility** — icon buttons have `aria-label`, images have `alt`, decorative icons are `aria-hidden`, destructive actions require confirmation, loading copy consistently ends in "…".

## Resolved in this pass

| Area           | Summary                                                                                                                                                                                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture   | `clients/new.tsx` + `policies/new.tsx` loaders converted from mutating-on-GET to real POST `action`s (4 callers migrated `<Link>`/`navigate()` → `<Form>`/`useSubmit()`)                                                                                                                                              |
| Architecture   | `email-template-editor.server.ts` + `document-template-editor.server.ts` no longer import `react-router` — added framework-agnostic `redirectResponse()` helper (`app/lib/http/redirect-response.ts`)                                                                                                                 |
| Performance    | `listDocumentTemplates()` now selects only the 7 metadata columns the list view needs instead of full `templateJson` blobs per version row                                                                                                                                                                            |
| Performance    | N+1 per-rate state lookups in `esl-schedule.ts` / `stamp-schedule.ts` replaced with one `loadStateIdByCode()` map per transaction (mirrors the existing correct pattern in `terror-schedule.ts`)                                                                                                                      |
| Error handling | Raw `throw new Error(...)` replaced with typed `NotFoundError`/`ConflictError`/`ValidationError`/`ExternalServiceError` across 9 service files (price schedules, clients, users, account managers, authorised representatives, car wording, policy orchestration)                                                     |
| Security       | `api/audit.tsx` request body now Zod-parsed (`auditBodySchema.safeParse`) instead of a `(await request.json()) as {...}` type assertion                                                                                                                                                                               |
| Bug            | Fixed the one real ESLint error (`react-hooks/set-state-in-effect` in `session-timeout-dialog.tsx`) — config resync moved to render-time state reset, impure ref/`Date.now()` writes kept in a `useEffect`                                                                                                            |
| UI             | 3 hand-rolled `fixed`/`z-50` modals (prices dialogs) replaced with Base UI `Dialog`/`DialogContent`/`DialogFooter`, gaining focus-trap/Escape/`aria-modal` for free; removed a dead duplicate `PriceDeleteDialog`                                                                                                     |
| Hygiene        | Deleted dead `resetDocumentTemplate` export (zero callers)                                                                                                                                                                                                                                                            |
| Hygiene        | Deleted 2 barrel files (`price/index.ts`, `policy/documents/index.ts`); the few real callers now import directly from sibling modules                                                                                                                                                                                 |
| Accessibility  | Added `type="tel"` + `autoComplete="tel"` to the client phone field                                                                                                                                                                                                                                                   |
| TypeScript     | Fixed a deep relative import (`../../routes/...` → a proper `EmailTemplateEditorLoaderData` type in `app/lib/email/template-editor-types.ts`, mirroring the existing document-template pattern)                                                                                                                       |
| TypeScript     | Removed `COVER_LABELS.null!` non-null assertion (extracted `ALL_COVER_TYPES_LABEL` constant)                                                                                                                                                                                                                          |
| TypeScript     | Replaced the repeated `"" as unknown as number/boolean` double-cast pattern (12+ sites) with a single documented `as never` cast; tightened 2 other double-casts to single casts                                                                                                                                      |
| UI consistency | Converted 2 raw `<table>` implementations (`car-adjustment-wizard.tsx`, `section-premium-declaration.tsx`) to the shared `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableCell` components; fixed an import-order violation in the same file                                                                        |
| UI consistency | Extracted the duplicated floating-listbox positioning/portal logic from 3 near-identical autocomplete components into a shared `app/components/ui/floating-listbox.tsx` (`useFloatingListPosition` + `FloatingListbox`), removing ~90 duplicated lines and standardizing `z-50` (was inconsistently `z-[100]` in one) |
| React patterns | Converted `useEffect` prop-resync ("sync prop into state") patterns to render-time state resets in `use-notes.ts` and `use-premium-calc.ts`, keeping only genuinely impure work (ref/`Date.now()` writes, `fetcher.submit`) inside actual effects                                                                     |
| Duplication    | Removed a duplicated ~45-line premium-section JSX block in `section-stack.tsx` (previously rendered twice for the `premiumPinned` true/false branches) by computing it once and placing it conditionally                                                                                                              |
| Complexity     | Converted the flagged 10-parameter `toDrawOp` function in `endorsement-expand.ts` to a single options object                                                                                                                                                                                                          |

## Open findings — documented debt

Two items were deliberately **not** touched because fixing them properly is a larger structural change with real regression risk, and the repo's own decision rule ("prefer simpler; don't rewrite working code unnecessarily"; "split on touch," not big-bang) argues against forcing them into this pass:

1. **PDF/pricing file-splitting** — `html-rich-text-lines.ts`, `premium-workings.ts`, and `document-templates.ts` (plus `html-rich-text-draw.ts`, `endorsement-expand.ts`) remain over the 500-line file cap, with some functions still well over the 50-line function cap (e.g. `htmlToDrawLines` ~387 lines). These are core PDF pagination/layout and financial-calculation engines with subtle behavior (page-break logic, font metrics, premium formulas) that's hard to verify purely by code inspection. Splitting them without dedicated test coverage for the exact pagination/premium edge cases risks silent regressions in generated policy documents or premium figures. **Recommendation:** add golden-fixture tests for pagination edge cases and premium formula variants first, then split incrementally on next touch.
2. **CAR wizard** `readOnly`**/**`freshSteps`**/**`isNew` **compound-component refactor** — `car-policy-wizard-shared.tsx`/`car-policy-wizard-inner.tsx` still thread 3 independent boolean flags through ~10 files instead of explicit variant components or a `PolicyWizardProvider` context. The immediate duplication this caused (`section-stack.tsx`'s repeated premium-section block) was removed in this pass, but the underlying boolean-prop threading was left alone. This is the highest-traffic, most business-critical surface in the app (quote → bind → adjust flow); a full compound-component migration touches every wizard section and step, and is high risk to attempt without a dedicated QA pass across all wizard modes (new/edit/read-only/adjustment). **Recommendation:** treat as a dedicated follow-up project, not an incidental cleanup.

Also intentionally left: `console.warn` in `app/components/reui/tree.tsx` — vendored ReUI component with its own `eslint-disable` banner, not authored app code.

## Verification evidence

| Check                              | Result                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `npm run typecheck`                | Pass (0 errors)                                                                  |
| `npm run lint`                     | Pass (0 errors) — includes the fixed `react-hooks/set-state-in-effect` violation |
| `npm run test:unit`                | Pass — 31 files, 163 tests                                                       |
| `npm run test:integration`         | Pass — 1 file, 4 tests                                                           |
| `prettier --check` (touched files) | Pass — all matched files use Prettier code style                                 |
| Worker-bundle static-import scan   | 0 violations across `app/routes/**`                                              |
| Authz coverage scan                | 100% of `api/*` routes + loaders/actions call `requireAuth`                      |

## Residual risk

- The two documented-debt items above are unresolved by design — see recommendations for how to unblock them safely.
- No authenticated browser/e2e pass was run against this diff; verification is `npm run typecheck` + `lint` + unit/integration tests + static inspection. The route-to-action conversions (`clients/new.tsx`, `policies/new.tsx`) and the Base UI dialog swaps (prices) are the highest-value candidates for a manual click-through or the Playwright suite (`npm run test:e2e:local`) before merge, since they change real user-facing interaction (GET→POST navigation, custom modal → `Dialog` primitive).
