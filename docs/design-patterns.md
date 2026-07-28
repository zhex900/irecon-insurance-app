# Design patterns

Patterns we use (or are migrating toward) in BrokerSure. Prefer the simplest pattern that fits — see architecture principles.

## Service pattern

**Where:** `app/lib/services/*`

- Encapsulates business rules and orchestration.
- Framework-agnostic (no React / React Router).
- Called from loaders/actions only (or other services).
- Returns domain results / DTOs; throws typed domain errors.

```text
action → policyService.save(input, user) → mapper.toDto(row)
```

## Repository / data access

**Where:** `app/lib/db/*` and service-owned queries (today often inside services / `store.ts`)

- Isolates Drizzle/SQL.
- Returns rows or persistence models — **not** UI DTOs.
- Services map rows → domain/DTO before crossing the route boundary.

Target: split `store.ts` into per-domain repositories or domain services that own DB access.

## Mapper / DTO

**Where:** e.g. `app/lib/db/policy-mapper.ts`, `types.ts`

```text
DB row → domain / DTO → loaderData → UI props
```

- One place to rename columns, hide internals, and keep the UI stable.
- Never pass raw Drizzle rows into components.

## Adapter

**Where:** `app/lib/supabase/*`, R2/storage helpers, future Resend client

- Wrap third parties behind a narrow API.
- Translate vendor errors → `ExternalServiceError`.
- Keeps services free of SDK sprawl.

## Strategy

**Where:** `app/server/pricing/*` (calculators, rate resolution)

- Swap formulas/strategies without changing route code.
- Keep strategies pure and unit-tested.

## Factory

Use sparingly — only when object creation is non-obvious (e.g. draft policy defaults, PDF template selection).

- Prefer plain functions: `createDraftPolicy(input)`.
- Avoid class hierarchies.

## Composition (UI)

**Where:** `app/components/**`

- Compose shadcn/ReUI primitives; don’t inherit.
- Domain components compose primitives + RHF fields.
- Extract hooks for reusable UI behavior (`app/hooks/`).

## Dependency direction

```text
routes → services → db / pricing / adapters
              ↘ zod (schemas co-owned or imported)
components → hooks → (fetcher clients only)
```

Dependencies point **inward** to domain/services. UI never imports Drizzle. Services never import React.

## Anti-patterns

| Avoid                          | Prefer                             |
| ------------------------------ | ---------------------------------- |
| God `store.ts` growth          | Split by domain on touch           |
| Business rules in JSX          | Service method                     |
| Fetch in `useEffect`           | `loader` / `action` / `useFetcher` |
| New abstraction “just in case” | Copy once; abstract at three       |
| Barrel `index.ts` forests      | Direct `~/lib/...` imports         |

## When to add a pattern

Only if it removes duplication or complexity **now**. If the benefit is not obvious, don’t.
