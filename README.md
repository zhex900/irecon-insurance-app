# Irecon Insurance (CAR Broker Portal)

Broker-only Contractors All Risks insurance app.

Clients, policies, prices, and users persist in **Supabase Postgres** via Drizzle ORM.

### Docs

| Doc                                                                                        | Purpose                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------- |
| [AGENTS.md](AGENTS.md)                                                                     | AI behavior only                            |
| [docs/architecture/performance.md](docs/architecture/performance.md)                       | Layering, queries, render, Worker bundles   |
| [docs/guidelines/coding-standards.md](docs/guidelines/coding-standards.md)                 | TypeScript, React, Router, errors, security |
| [docs/guidelines/design-patterns.md](docs/guidelines/design-patterns.md)                   | Service, repository, mapper, composition    |
| [docs/guidelines/ui-guidelines.md](docs/guidelines/ui-guidelines.md)                       | shadcn/ReUI, Tailwind, accessibility        |
| [docs/guidelines/code-review.md](docs/guidelines/code-review.md)                           | Pre-finish / review checklist               |
| [docs/development/email.md](docs/development/email.md)                                     | Resend document send + Supabase auth mail   |
| [docs/development/testing.md](docs/development/testing.md)                                 | Vitest + Playwright                         |
| [docs/guidelines/tooling.md](docs/guidelines/tooling.md)                                   | ESLint, Prettier, husky, verify             |
| [docs/architecture/refactor-to-production.md](docs/architecture/refactor-to-production.md) | Production hardening plan                   |
| [docs/domain.md](docs/domain.md)                                                           | Hostnames, environments, DNS                |
| [docs/deployment/preview-environments.md](docs/deployment/preview-environments.md)         | Per-PR Cloudflare + Supabase preview        |

## Stack

| Layer             | Technology                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Runtime**       | [Cloudflare Workers](https://developers.cloudflare.com/workers/) (main SSR app) + dedicated PDF and Excel Workers                                    |
| **Framework**     | [React Router 8](https://reactrouter.com) (framework mode) on [Vite 8](https://vite.dev)                                                             |
| **UI**            | [React 19](https://react.dev), [TypeScript](https://www.typescriptlang.org), [Tailwind CSS 4](https://tailwindcss.com)                               |
| **Components**    | [shadcn/ui](https://ui.shadcn.com) (`base-nova`) + [ReUI](https://reui.io) on [Base UI](https://base-ui.com)                                         |
| **Forms**         | [React Hook Form](https://react-hook-form.com) + [Zod 4](https://zod.dev)                                                                            |
| **Database**      | [Supabase](https://supabase.com) Postgres via [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) + [Drizzle ORM](https://orm.drizzle.team)  |
| **Auth**          | Supabase Auth (SSR cookies)                                                                                                                          |
| **Storage**       | Cloudflare R2 (avatars, generated documents)                                                                                                         |
| **PDF**           | [pdfme](https://pdfme.com) (client-only dynamic import), [pdf-lib](https://pdf-lib.js.org); generation in a private PDF Worker                       |
| **Email**         | [Resend](https://resend.com) + [React Email](https://react.email) editor (TipTap, client-only)                                                       |
| **Excel**         | [ExcelJS](https://github.com/exceljs/exceljs) in a dedicated Excel Worker                                                                            |
| **Observability** | [Sentry](https://sentry.io) + Cloudflare Workers Observability                                                                                       |
| **Testing**       | [Vitest](https://vitest.dev) (unit/integration), [Playwright](https://playwright.dev) (e2e/smoke), [@faker-js/faker](https://fakerjs.dev) (fixtures) |

Requires **Node.js 24+** and **[pnpm](https://pnpm.io)** (see `packageManager` in `package.json`). Local Postgres via Supabase CLI (Docker).

## Repo layout

```text
app/           React Router application
workers/       PDF and Excel Cloudflare Workers (private services)
deployment/    Deploy, preview envs, Cloudflare/Supabase ops
public/        Static assets
scripts/       DB seed/migrate, dev tooling, quality checks — see scripts/README.md
supabase/      Migrations + local Supabase config
docs/          Living docs (incl. production refactor plan)
_archive/      Legacy app, specs, CSVs, MSSQL dumps (not deployed)
```

## Run locally

Requires Node.js 24+, [Docker](https://docs.docker.com/get-docker/), and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
corepack enable   # once per machine, if pnpm is not on PATH
pnpm install
cp .env.example .env   # DATABASE_URL points at local Supabase
pnpm run db:start       # starts local Postgres on :54322
pnpm run db:reset       # apply migrations + seed
pnpm run db:copy:uat    # replace local DB with full UAT copy (.env.uat → .env)
pnpm run db:copy:prod -- --confirm   # replace production DB with UAT (.env.uat → .env.production)
pnpm run dev            # http://127.0.0.1:5173
# Second terminal: private PDF service used by email attachment rendering
pnpm run dev:pdf-worker
```

Sign in with a seeded user from `_archive/data/users.json`. Default password: `password123`.

## Data

| Source                                   | Purpose                                                      |
| ---------------------------------------- | ------------------------------------------------------------ |
| Supabase Postgres                        | Runtime clients, policies, ARs, users, prices, `car_wording` |
| `app/lib/reference-data.ts`              | Static lookup catalogues (migrate to DB over time)           |
| Postgres `app_document_template_version` | pdfme PDF layouts (Settings → Document templates)            |
| `_archive/data/`                         | Seed/fixture JSON for scripts                                |
| `_archive/seeds-source/`                 | Legacy CSV imports for seed scripts                          |
| `supabase/migrations/`                   | Schema migrations                                            |

## Scripts

```bash
pnpm run db:start
pnpm run db:stop
pnpm run db:status
pnpm run db:reset          # reset DB + seed
pnpm run db:seed
pnpm run db:migrate:prices # MSSQL CAR prices → Postgres (repeatable)
pnpm run db:seed:prices    # load from _archive/data/prices.json
pnpm run db:export:prices  # MSSQL → JSON snapshot only
pnpm run db:push           # drizzle-kit push (dev only)
pnpm run dev
pnpm run build
pnpm run build:pdf-worker # PDF Worker dry-run bundle
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run verify            # lint + format:check + typecheck + unit
pnpm run test              # Vitest
pnpm run test:e2e          # Playwright (needs `pnpm exec playwright install chromium`)
pnpm run test:smoke        # Playwright smoke subset
pnpm run deploy            # UAT (default)
pnpm run deploy --env pr-11
pnpm run destroy --env pr-11
pnpm run deploy:uat
pnpm run deploy:secret
```

See [docs/development/testing.md](docs/development/testing.md), [docs/guidelines/tooling.md](docs/guidelines/tooling.md), and [docs/deployment/preview-environments.md](docs/deployment/preview-environments.md).

## UI components

```bash
npx shadcn@latest add button input card table sidebar
npx shadcn@latest add @reui/stepper @reui/data-grid @reui/filters
```

Primitives: `app/components/ui/` (shadcn), `app/components/reui/` (ReUI).
