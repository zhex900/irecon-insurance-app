# BrokerSure (CAR Broker Portal)

Broker-only Contractors All Risks insurance app.

Clients, policies, prices, and users persist in **Supabase Postgres** via Drizzle ORM.

### Docs

| Doc                                                              | Purpose                                     |
| ---------------------------------------------------------------- | ------------------------------------------- |
| [AGENTS.md](AGENTS.md)                                           | AI behavior only                            |
| [docs/architecture.md](docs/architecture.md)                     | Principles, layering, folder ownership      |
| [docs/coding-standards.md](docs/coding-standards.md)             | TypeScript, React, Router, errors, security |
| [docs/design-patterns.md](docs/design-patterns.md)               | Service, repository, mapper, composition    |
| [docs/performance.md](docs/performance.md)                       | Queries, render, Workers                    |
| [docs/ui-guidelines.md](docs/ui-guidelines.md)                   | shadcn/ReUI, Tailwind, accessibility        |
| [docs/code-review.md](docs/code-review.md)                       | Pre-finish / review checklist               |
| [docs/email.md](docs/email.md)                                   | Resend document send + Supabase auth mail   |
| [docs/testing.md](docs/testing.md)                               | Vitest + Playwright                         |
| [docs/tooling.md](docs/tooling.md)                               | ESLint, Prettier, husky, verify             |
| [docs/REFACTOR_TO_PRODUCTION.md](docs/REFACTOR_TO_PRODUCTION.md) | Production hardening plan                   |

## Stack

- React Router 8 (framework mode) + Cloudflare Workers
- React 19 + TypeScript
- Tailwind CSS 4
- React Hook Form + Zod
- Supabase (Postgres + Auth) + Drizzle ORM
- [shadcn/ui](https://ui.shadcn.com) (`base-nova`) + [ReUI](https://reui.io)

## Repo layout

```text
app/           React Router application
public/        Static assets
scripts/       Seed, deploy, MCP helpers
supabase/      Migrations + local Supabase config
docs/          Living docs (incl. production refactor plan)
_archive/      Legacy app, specs, CSVs, MSSQL dumps (not deployed)
```

## Run locally

Requires [Docker](https://docs.docker.com/get-docker/) and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
cp .env.example .env   # DATABASE_URL points at local Supabase
npm run db:start       # starts local Postgres on :54322
npm run db:reset       # apply migrations + seed
npm run dev            # http://127.0.0.1:5173
```

Sign in with a seeded user from `_archive/data/users.json`. Default password: `password123`.

## Data

| Source                        | Purpose                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| Supabase Postgres             | Runtime clients, policies, ARs, users, prices, `car_wording` |
| `app/lib/reference-data.ts`   | Static lookup catalogues (migrate to DB over time)           |
| `app/lib/car-wording-data.ts` | Fallback if `car_wording` table is empty                     |
| `app/assets/pdf-templates/`   | PDF layout templates                                         |
| `_archive/data/`              | Seed/fixture JSON for scripts                                |
| `_archive/seeds-source/`      | Legacy CSV imports for seed scripts                          |
| `supabase/migrations/`        | Schema migrations                                            |

## Scripts

```bash
npm run db:start
npm run db:stop
npm run db:status
npm run db:reset          # reset DB + seed
npm run db:seed
npm run db:push           # drizzle-kit push (dev only)
npm run dev
npm run build
npm run typecheck
npm run lint
npm run format:check
npm run verify            # lint + format:check + typecheck + unit
npm run test              # Vitest
npm run test:e2e          # Playwright (needs `npx playwright install chromium`)
npm run test:smoke        # Playwright smoke subset
npm run deploy:staging
npm run deploy:secret
```

See [docs/testing.md](docs/testing.md) and [docs/tooling.md](docs/tooling.md).

## UI components

```bash
npx shadcn@latest add button input card table sidebar
npx shadcn@latest add @reui/stepper @reui/data-grid @reui/filters
```

Primitives: `app/components/ui/` (shadcn), `app/components/reui/` (ReUI).
