# AGENTS.md

AI assistant behavior for Irecon Insurance (CAR broker portal).

This file is **behavior only**. Engineering rules live in `docs/`.

## Read by task

| Task                                        | Document                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Layering, data flow, folder ownership       | [docs/architecture.md](docs/architecture.md)                                                         |
| TypeScript, React, Router, errors, security | [docs/coding-standards.md](docs/coding-standards.md)                                                 |
| Patterns (service, repository, mapper, …)   | [docs/design-patterns.md](docs/design-patterns.md)                                                   |
| Queries, render, bundle                     | [docs/performance.md](docs/performance.md)                                                           |
| UI / forms / a11y                           | [docs/ui-guidelines.md](docs/ui-guidelines.md)                                                       |
| Before finishing any change                 | [docs/code-review.md](docs/code-review.md)                                                           |
| Production roadmap                          | [docs/REFACTOR_TO_PRODUCTION.md](docs/REFACTOR_TO_PRODUCTION.md)                                     |
| Testing                                     | [docs/testing.md](docs/testing.md)                                                                   |
| Lint / format                               | [docs/tooling.md](docs/tooling.md)                                                                   |
| CAR premium / terrorism formulas            | [docs/pricing/car-premium-formulas.md](docs/pricing/car-premium-formulas.md)                         |
| Legacy vs rebuild manual premium quirks     | [docs/pricing/legacy-vs-rebuild-premium-manual.md](docs/pricing/legacy-vs-rebuild-premium-manual.md) |
| Observability (CF + Sentry)                 | [docs/observability.md](docs/observability.md)                                                       |
| How to run                                  | [README.md](README.md)                                                                               |

## AI coding rules

When generating or editing code:

1. **Prefer editing existing files** over creating new ones.
2. **Do not rewrite** working code unnecessarily.
3. **Reuse** existing abstractions — search before adding utilities.
4. **Follow existing naming** in the nearest similar module.
5. **Do not introduce libraries** without explicit approval.
6. **Ask before** architecture, schema, or auth-model changes.
7. **Prefer consistency over novelty.**
8. **Leave unrelated code untouched.**
9. **Prefer deleting code** over adding abstractions.
10. **Self-review** with [docs/code-review.md](docs/code-review.md) before claiming done.
11. **Prevent bundle balloons** — before adding imports to routes or shared SSR modules, check they won’t pull pdfme/TipTap/WASM into the Worker; use dynamic `import()`, light helper modules, and `vite.stub-client-only.ts` for client-only packages ([docs/performance.md](docs/performance.md) § Bundle & Workers).

## Decision rule

When multiple solutions exist, choose in this order:

1. Simpler
2. More readable
3. More maintainable
4. More testable
5. More consistent with this repo
6. More performant

**Performance is never chosen over readability without evidence.** Measure first ([docs/performance.md](docs/performance.md)).

## Non-negotiables (quick)

- Routes coordinate; services own business rules; components render.
- Authz on every loader/action/`api/*` — not UI-only.
- Zod at every untrusted boundary.
- `*.server.ts` never imported from the client.
- shadcn `base-nova` + ReUI only — no parallel UI kit.
- No secrets, PII dumps, or `_archive/` imports in the app.
- URL paths stay stable (`app/routes.ts`).
- `npm run typecheck` must pass.
- **Keep Worker/SSR bundles small** — no static `@pdfme/generator` / `@pdfme/ui` (or other heavy) imports in routes; dynamic-import PDF/Designer code; don’t ship full template history in loaders ([docs/performance.md](docs/performance.md) § Bundle & Workers).

## Before / after

**Before:** identify domain → find nearest route/service/component → match style → for UI, ReUI/shadcn search → install → adapt.

**After:** typecheck → smoke the path → run [docs/code-review.md](docs/code-review.md).

## Skills & MCP

| Resource      | Where                                       |
| ------------- | ------------------------------------------- |
| shadcn skill  | `.cursor/skills/shadcn/`                    |
| ReUI skill    | `.cursor/skills/reui/`                      |
| ReUI rule     | `.cursor/rules/reui.mdc`                    |
| Worker bundle | `.cursor/rules/worker-bundle.mdc` (always)  |
| ReUI MCP      | `.mcp.json` / `.cursor/mcp.json`            |
| MSSQL MCP     | migration/export only — runtime is Postgres |

## When unsure

Ask. Prefer small, reversible changes aligned with [docs/REFACTOR_TO_PRODUCTION.md](docs/REFACTOR_TO_PRODUCTION.md).
