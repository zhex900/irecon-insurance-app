# Domain documentation index

Domain-specific docs live under `docs/domains/`.

## Active areas

| Domain           | Location                                                                             | Notes                                               |
| ---------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Legacy migration | [migration/legacy-policy-field-mapping.md](migration/legacy-policy-field-mapping.md) | Field-level mapping reference for migrated policies |
| Pricing          | [pricing/](pricing/)                                                                 | CAR premium formulas, legacy vs rebuild quirks      |
| Security         | [security/](security/)                                                               | Worker security plans and review checklists         |

## Related (outside `domains/`)

| Topic                               | Location                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| MSSQL → Postgres migration workflow | [../legacy-db-migration/README.md](../legacy-db-migration/README.md)                           |
| pdfme / template editor migration   | [../migration/](../migration/)                                                                 |
| PDF worker architecture             | [../PDF_TEMPLATE_EDITOR_WORKER_ARCHITECTURE.md](../PDF_TEMPLATE_EDITOR_WORKER_ARCHITECTURE.md) |
| Excel worker notes                  | [excel-worker-implementation-summary.md](excel-worker-implementation-summary.md)               |

Workers (PDF, Excel) deploy via `wrangler` and `npm run dev:both-workers`; see [scripts/dev/start-both-workers.sh](../../scripts/dev/start-both-workers.sh).
