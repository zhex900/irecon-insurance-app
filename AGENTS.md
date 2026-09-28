# AGENTS.md

AI assistant behavior for Irecon Insurance (CAR broker portal).

This file is **behavior only**. Engineering rules live in `docs/`.

## Read by task

| Task                                        | Document                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Layering, data flow, folder ownership       | [docs/architecture/performance.md](docs/architecture/performance.md)                                                 |
| TypeScript, React, Router, errors, security | [docs/guidelines/coding-standards.md](docs/guidelines/coding-standards.md)                                           |
| Patterns (service, repository, mapper, …)   | [docs/guidelines/design-patterns.md](docs/guidelines/design-patterns.md)                                             |
| Queries, render, bundle                     | [docs/architecture/performance.md](docs/architecture/performance.md)                                                 |
| UI / forms / a11y                           | [docs/guidelines/ui-guidelines.md](docs/guidelines/ui-guidelines.md)                                                 |
| Before finishing any change                 | [docs/guidelines/code-review.md](docs/guidelines/code-review.md)                                                     |
| Production roadmap                          | [docs/architecture/refactor-to-production.md](docs/architecture/refactor-to-production.md)                           |
| Interim schema / JSONB normalization        | [docs/architecture/interim-data-patterns.md](docs/architecture/interim-data-patterns.md)                             |
| Testing                                     | [docs/development/testing.md](docs/development/testing.md)                                                           |
| Lint / format                               | [docs/guidelines/tooling.md](docs/guidelines/tooling.md)                                                             |
| Policy series vs policy numbers             | [docs/domains/policy-series-and-numbers.md](docs/domains/policy-series-and-numbers.md)                               |
| CAR premium / terrorism formulas            | [docs/domains/pricing/car-premium-formulas.md](docs/domains/pricing/car-premium-formulas.md)                         |
| Legacy vs rebuild manual premium quirks     | [docs/domains/pricing/legacy-vs-rebuild-premium-manual.md](docs/domains/pricing/legacy-vs-rebuild-premium-manual.md) |
| Observability (CF + Sentry)                 | [docs/deployment/observability.md](docs/deployment/observability.md)                                                 |
| Per-PR preview environments                 | [docs/deployment/preview-environments.md](docs/deployment/preview-environments.md)                                   |
| How to run                                  | [README.md](README.md)                                                                                               |

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
10. **Self-review** with [docs/guidelines/code-review.md](docs/guidelines/code-review.md) before claiming done.
11. **Prevent bundle balloons** — before adding imports to routes or shared SSR modules, check they won’t pull pdfme/TipTap/WASM into the Worker; use dynamic `import()`, light helper modules, and `vite.stub-client-only.ts` for client-only packages ([docs/architecture/performance.md](docs/architecture/performance.md) § Bundle & Workers).

## Decision rule

When multiple solutions exist, choose in this order:

1. Simpler
2. More readable
3. More maintainable
4. More testable
5. More consistent with this repo
6. More performant

**Performance is never chosen over readability without evidence.** Measure first ([docs/architecture/performance.md](docs/architecture/performance.md)).

## Non-negotiables (quick)

- Routes coordinate; services own business rules; components render.
- Authz on every loader/action/`api/*` — not UI-only.
- Zod at every untrusted boundary.
- `*.server.ts` never imported from the client.
- shadcn `base-nova` + ReUI only — no parallel UI kit.
- No secrets, PII dumps, or `_archive/` imports in the app.
- URL paths stay stable (`app/routes.ts`).
- `pnpm run typecheck` must pass.
- **Keep Worker/SSR bundles small** — no static `@pdfme/generator` / `@pdfme/ui` (or other heavy) imports in routes; dynamic-import PDF/Designer code; don’t ship full template history in loaders ([docs/architecture/performance.md](docs/architecture/performance.md) § Bundle & Workers).

## Before / after

**Before:** identify domain → find nearest route/service/component → match style → for UI, ReUI/shadcn search → install → adapt.

**After:** typecheck → smoke the path → run [docs/guidelines/code-review.md](docs/guidelines/code-review.md).

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

Ask. Prefer small, reversible changes aligned with [docs/architecture/refactor-to-production.md](docs/architecture/refactor-to-production.md).
