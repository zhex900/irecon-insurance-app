# Scripts

Operational scripts for database work, local development, bundle checks, and code-quality tooling. Deploy and Cloudflare/Supabase environment automation live in [`deployment/`](../deployment/).

## Layout

```text
scripts/
├── ci/              CI helpers (Supabase start + reset)
├── db/
│   ├── lib/         Shared DB env helpers (migrate-target-env, clear-domain-*)
│   ├── seed/        Local seeding and CSV parsers
│   ├── clear/       Domain table clears
│   ├── legacy/      MSSQL → Postgres legacy migration
│   │   ├── lib/     Mappers, loaders, R2 upload helpers
│   │   └── sql/     MSSQL export queries
│   ├── mssql/       CAR pricing catalogue migration
│   ├── repair/      Post-migration policy repairs
│   └── push-uat/    Push templates/wording to UAT
├── dev/             Local worker dev helpers
├── bundle/          Worker bundle size checks
├── quality/         Hook grouping and file-organization lint
├── mcp/             MCP server launch scripts (.cursor/mcp.json)
└── test/            Ad-hoc verification scripts
```

## Common commands

| `pnpm run` script    | Script path                                      |
| -------------------- | ------------------------------------------------ |
| `db:seed`            | `scripts/db/seed/seed-db.mts`                    |
| `db:migrate:legacy*` | `scripts/db/legacy/migrate-legacy-domain.mts`    |
| `db:export:legacy`   | `scripts/db/legacy/export-legacy-domain.mts`     |
| `db:migrate:prices`  | `scripts/db/mssql/migrate-prices-from-mssql.mts` |
| `db:clear:*`         | `scripts/db/clear/*.mts`                         |
| `db:repair:*`        | `scripts/db/repair/*.mts`                        |
| `ci:db`              | `scripts/ci/supabase-setup.mjs`                  |
| `check:bundle`       | `scripts/bundle/simple-bundle-check.js`          |
| `dev:both-workers`   | `scripts/dev/start-both-workers.sh`              |
| `check:organization` | `scripts/quality/check-organization.sh`          |

See [docs/legacy-db-migration/README.md](../docs/legacy-db-migration/README.md) for legacy migration workflow.
