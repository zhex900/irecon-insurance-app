# Architecture

Layering, data flow, folder ownership, and runtime shape for Irecon Insurance.

AI behavior: [AGENTS.md](../AGENTS.md). Standards: [coding-standards.md](coding-standards.md). Patterns: [design-patterns.md](design-patterns.md).

## Architecture principles

Immutable. Use these for trade-offs.

1. Prefer simplicity over cleverness.
2. Optimize for maintainability, not fewer lines of code.
3. Business logic belongs in services.
4. Components render UI.
5. Routes coordinate requests.
6. Data flows one direction.
7. Every abstraction must remove duplication or complexity.
8. If an abstraction is not obviously useful, don’t create it.
9. Prefer deleting code over adding abstractions.
10. The best code is code that no longer exists.

## Stack

| Layer   | Choice                                                             |
| ------- | ------------------------------------------------------------------ |
| App     | React Router 8 (SSR) on Cloudflare Workers                         |
| UI      | React 19, TypeScript strict, Tailwind 4, shadcn `base-nova` + ReUI |
| Forms   | react-hook-form + Zod                                              |
| DB      | Supabase Postgres + Drizzle + Hyperdrive                           |
| Auth    | Supabase Auth (cookies)                                            |
| Storage | R2 (avatars, library documents)                                    |
| Locale  | `en-AU`, AUD                                                       |

Primary deploy: **Cloudflare Workers** (`workers/app.ts`).

## Folder ownership

No crossing responsibilities.

| Path                                       | Owns                                                                                | Must not                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------- |
| `app/routes/`                              | HTTP coordination: auth gate, Zod parse, call service, map to redirect/JSON/UI      | Business rules, Drizzle, premium math  |
| `app/lib/services/`                        | Business rules, orchestration, transactions                                         | `react`, `react-router`, hooks, JSX    |
| `app/lib/db/`                              | Schema, client, mappers                                                             | UI, HTTP                               |
| `app/lib/zod/`                             | Validation schemas                                                                  | Side effects                           |
| `app/components/`                          | Rendering                                                                           | DB access, auth decisions as sole gate |
| `app/hooks/`                               | Reusable UI logic                                                                   | Server imports                         |
| `app/server/pricing/`                      | Pure premium calculators ([formulas](pricing/car-premium-formulas.md))              | Framework imports                      |
| `app/lib/observability/`                   | Structured logger, requestId, Sentry helpers ([observability.md](observability.md)) | Domain UI / PII dumps                  |
| `app/lib/` (utils, pdf, storage, supabase) | Cross-cutting infrastructure                                                        | Domain UI                              |
| `supabase/`                                | Migrations, local config                                                            | App UI                                 |
| `_archive/`                                | Historical only                                                                     | Anything imported by the app           |

Path alias: `~/` → `./app/*`.

## One-direction data flow

```text
DB row
  → repository / query (db)
  → domain model (service)
  → DTO (mapper)
  → loader/action data
  → UI
```

Never expose raw database rows to the UI. Never write from loaders (see [coding-standards.md](coding-standards.md)).

```text
Browser
  → Worker
    → Route loader | action | resource route
      → requireAuth / ownership / role
      → Zod (draft | full)
      → service (framework-agnostic)
           ├─ db / mapper
           ├─ server/pricing (pure)
           ├─ supabase / R2
      → redirect | JSON DTO | loaderData
  → Route component → domain components
```

## Runtime request flow (detail)

- **Page routes:** return UI (via default export). Loaders return serializable DTOs only.
- **Resource routes (`api/*`):** return JSON only — no document UI.
- **Actions:** own all mutations (DB writes, email, R2 writes).
- **Loaders:** deterministic reads only — no mutate, no email, no writes.

## Layers (current modules)

### Routes (`app/routes/` + `app/routes.ts`)

Explicit `route()` / `layout()` / `index()`. Folder tree by concern; **URLs come only from `routes.ts`**:

| Folder                | Concern                                           |
| --------------------- | ------------------------------------------------- |
| `_auth/`              | Login, logout, password, confirm                  |
| `_app/`               | Authenticated shell (`layout.tsx`) + domain pages |
| `_app/clients         | policies                                          | reports | settings/` | Domain UI routes |
| `api/`                | Resource routes (JSON only)                       |
| `_index.tsx`, `$.tsx` | Root redirect / catch-all                         |

Intents via `formData.get("intent")`. Types from `./+types/<filename>` next to each module.

### Services (`app/lib/services/`)

Domain folders — prefer these over the `store.ts` façade:

| Folder / module                                                 | Owns                                                |
| --------------------------------------------------------------- | --------------------------------------------------- |
| `clients/`                                                      | CRUD, drafts, list, dashboard stats                 |
| `policy/`                                                       | data, orchestration, drafts, documents, adjustments |
| `policies/`                                                     | Policy list queries                                 |
| `price/`                                                        | Catalogue snapshot/mutations, premium calc          |
| `users/`                                                        | User CRUD + list                                    |
| `authorised-representatives/`                                   | AR CRUD + list                                      |
| `reports/`                                                      | Report queries + report helpers                     |
| `search/`                                                       | Global search                                       |
| `documents/`                                                    | Library documents service                           |
| `audit/`                                                        | Audit write/read + client                           |
| `email/`                                                        | Email templates service                             |
| `shared/`                                                       | Shared list-query + draft-result helpers            |
| `reference.service.ts`, `broker-session.ts`, `feature-flags.ts` | Cross-cutting                                       |

Services must be **testable without a browser** and must not import React or React Router. Browser APIs live in `*.client.ts`.

### Data (`app/lib/db/`)

Schema, `getDb()` (request-scoped via `withRequestDb`), mappers, DTOs in `types.ts`. Migrations: `supabase/migrations/*.sql`.

### Validation (`app/lib/zod/`)

Draft (soft) vs full (`superRefine`) schemas. Validate at the route edge.

### Auth

`requireAuth` + roles (`broker` | `admin` | `super-admin`). Server-side only.

### Presentation

`components/ui` (shadcn), `components/reui` (ReUI), domain folders (`clients/`, `policies/wizard/`, `prices/`, `settings/`, …). See [ui-guidelines.md](ui-guidelines.md).

## Domains

| Domain      | Owns                                    |
| ----------- | --------------------------------------- |
| auth        | Session, roles, login/reset             |
| clients     | CRUD, drafts, AR link                   |
| policies    | CAR wizard, status, notes, clone/delete |
| pricing     | Premium, referral, catalogues           |
| adjustments | Turnover adjustment                     |
| documents   | PDF, library docs, document templates   |
| email       | Templates + Resend document send        |
| settings    | Users, features, AR, prices, templates  |
| reports     | List / export                           |
| audit       | Audit log                               |
| shared      | Primitives, utils, shared Zod           |

## Environments

| Env        | Notes                                       |
| ---------- | ------------------------------------------- |
| Local      | Supabase Docker + `npm run dev` on **5173** |
| Staging    | `deploy:staging`                            |
| Production | Workers + Hyperdrive + R2 + Supabase        |

Secrets only in env / Wrangler — never git.

## Cross-cutting

- Draft-create loaders redirect to edit.
- Autosave: `*.client.ts` → `api/*` → soft Zod → service.
- Audit material mutations.
- Feature-flag unfinished surfaces.
- API errors: `{ ok, errors?, formError? }`.

## Out of scope

MSSQL and `_archive/` are not part of the running app. Live contract = current schema + these docs.
