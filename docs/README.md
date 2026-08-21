# Documentation

Living docs for the Irecon Insurance CAR broker portal. AI behavior rules live in [AGENTS.md](../AGENTS.md) at the repo root.

## Structure

```text
docs/
├── guidelines/           Coding standards, UI, patterns, tooling, code review
├── architecture/         Performance, production roadmap
├── development/          Testing, email, e2e plan
├── deployment/           Preview envs, observability, monitoring
├── legacy-db-migration/  MSSQL → Postgres migration (primary migration docs)
├── domains/
│   ├── migration/        Legacy field mapping reference
│   ├── pricing/          CAR premium formulas
│   └── security/         Worker security plans and checklists
├── plans/                Implementation plans (not yet done)
└── migration/            pdfme migration notes (separate from legacy-db-migration)
```

## Quick access

| Topic                        | Document                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Coding standards             | [guidelines/coding-standards.md](guidelines/coding-standards.md)                 |
| UI / ReUI                    | [guidelines/ui-guidelines.md](guidelines/ui-guidelines.md)                       |
| Performance / Worker bundles | [architecture/performance.md](architecture/performance.md)                       |
| Interim data patterns        | [architecture/interim-data-patterns.md](architecture/interim-data-patterns.md)   |
| Testing                      | [development/testing.md](development/testing.md)                                 |
| Preview environments         | [deployment/preview-environments.md](deployment/preview-environments.md)         |
| Observability                | [deployment/observability.md](deployment/observability.md)                       |
| Legacy DB migration          | [legacy-db-migration/README.md](legacy-db-migration/README.md)                   |
| Production roadmap           | [architecture/refactor-to-production.md](architecture/refactor-to-production.md) |

## Repo layout (code)

| Path          | Purpose                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| `app/`        | React Router application                                                                     |
| `deployment/` | Deploy, preview envs, Cloudflare/Supabase ops                                                |
| `scripts/`    | DB seed/migrate, dev tooling, quality checks — see [scripts/README.md](../scripts/README.md) |
| `supabase/`   | Migrations + local Supabase config                                                           |
| `workers/`    | PDF and Excel Cloudflare Workers                                                             |
| `_archive/`   | Legacy data, specs, CSVs (not deployed)                                                      |

## Adding docs

1. Pick the folder by content type (guidelines, architecture, development, deployment, domains, plans).
2. Use **kebab-case** filenames.
3. Update cross-references when moving or renaming scripts.
