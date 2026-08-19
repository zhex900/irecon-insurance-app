# Legacy → Postgres mappings (summary)

Full policy field audit: [../domains/migration/legacy-policy-field-mapping.md](../domains/migration/legacy-policy-field-mapping.md)

Implementation: `scripts/lib/legacy-policy-mapper.mts`, `scripts/sql/legacy/*.sql`

---

## Domain tables

| Legacy (MSSQL)         | Postgres table                       | Notes                                       |
| ---------------------- | ------------------------------------ | ------------------------------------------- |
| `AccountManager`       | `account_manager`                    | 7 rows; deduped by ID                       |
| `WholesaleBroker`      | `authorised_representative`          | All rows (`689`)                            |
| `Client`               | `client`                             | UUID from `legacyClientUuid(clientId)`      |
| `Policy`               | `policy`                             | UUID from `legacyPolicyUuid(policyId)`      |
| `PolicyCAR`            | `policy_car`                         | Premium/rating columns + `app_extras` jsonb |
| `PolicyCAR` (adjusted) | `policy_car_adjustment`              | When `Adjusted = 1`                         |
| `PolicyDocument`       | `policy_car.app_extras.documents`    | Separate documents slice; PDFs in R2        |
| `PolicyNote`           | `policy_car.app_extras.notes`        | In policy export                            |
| `PolicyCARWording`     | `app_extras` wordings / selected IDs | In policy export                            |

---

## ID mapping

| Legacy integer    | Postgres                                        |
| ----------------- | ----------------------------------------------- |
| `Policy.PolicyId` | Deterministic UUID `legacyPolicyUuid(policyId)` |
| `Client.ClientId` | Deterministic UUID `legacyClientUuid(clientId)` |
| Account manager   | Fixed map in `legacy-account-manager-map.mts`   |

---

## Policy highlights

| Rebuild field                                | Legacy source                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `policyNumber`                               | `Policy.PolicyNumber`                                                                                   | Deduped renewals: `-{year}` → `-{year}-{month}` → `-{YYYY-MM-DD}` → UUID hash |
| `policyCategoryId`                           | `Policy.PolicyAction` — `NEW`→1, `RWL`→2                                                                |
| `coverTypeId`                                | `PolicyCAR.CoverType`                                                                                   |
| `dateStart` / `dateEnd`                      | `InceptionDate` / `ExpiryDate`                                                                          |
| `insuredName`, `siteAddress`, turnover, etc. | `PolicyCAR.*`                                                                                           |
| Premium columns                              | `PolicyCAR` premium fields → `policy_car` numerics                                                      |
| Excesses                                     | `PolicyCARExcess` → `app_extras.excesses`                                                               |
| Period fields                                | `MaximumConstructionPeriod` / `MaximumMaintenancePeriod` — `0` treated as unset; defaults by cover type |

---

## Documents (separate slice)

| Legacy               | Target                                                                     |
| -------------------- | -------------------------------------------------------------------------- |
| `PolicyDocument` row | `PolicyDocument` object in `app_extras.documents[]`                        |
| PDF on disk          | R2 key `policies/{policyUuid}/{docId}-{filename}`                          |
| Bucket               | `insurance-app-library-documents` (override: `R2_POLICY_DOCUMENTS_BUCKET`) |

---

## Repair scripts

| Issue                       | Command                                              |
| --------------------------- | ---------------------------------------------------- |
| Period fields `0` / invalid | `npm run db:repair:policy-periods -- --env=local`    |
| Other migrated field gaps   | `npm run db:repair:migrated-policies -- --env=local` |

Add `--confirm` for UAT/prod.
