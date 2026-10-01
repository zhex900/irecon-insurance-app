# Domain documentation index

Domain-specific docs live under `docs/domains/`.

## Active areas

| Domain           | Location                                                                             | Notes                                                |
| ---------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Policy numbers   | [policy-series-and-numbers.md](policy-series-and-numbers.md)                         | Series vs term `policy_number`, renewals, allocation |
| Legacy migration | [migration/legacy-policy-field-mapping.md](migration/legacy-policy-field-mapping.md) | Field-level mapping reference for migrated policies  |
| Pricing          | [pricing/](pricing/)                                                                 | CAR premium formulas, legacy vs rebuild quirks       |
| Security         | [security/](security/)                                                               | Worker security plans and review checklists          |

## Related (outside `domains/`)

| Topic                               | Location                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| MSSQL → Postgres migration workflow | [../legacy-db-migration/README.md](../legacy-db-migration/README.md)                           |
| Interim schema / JSONB patterns     | [../architecture/interim-data-patterns.md](../architecture/interim-data-patterns.md)           |
| pdfme / template editor migration   | [../migration/](../migration/)                                                                 |
| PDF worker architecture             | [../PDF_TEMPLATE_EDITOR_WORKER_ARCHITECTURE.md](../PDF_TEMPLATE_EDITOR_WORKER_ARCHITECTURE.md) |
| Excel worker notes                  | [excel-worker-implementation-summary.md](excel-worker-implementation-summary.md)               |

Workers (PDF, Excel) deploy via `wrangler` and `npm run dev:all-workers`; see [scripts/dev/start-all-workers.sh](../../scripts/dev/start-all-workers.sh).
