# Legacy MSSQL → Postgres CAR policy field mapping

Review document for migrated policies. Source: `scripts/sql/legacy/policies.sql`, `scripts/lib/legacy-policy-mapper.mts`, and rebuild validation in `app/lib/zod/policy-car.ts`.

**Last audited:** local DB after legacy migration (`created_by = 'migrate:mssql'`, 5,101 policies).

---

## Summary: period fields (reported issue)

| Policy example                                        | Legacy stored                                                   | Migrated (before fix)    | Expected after fix                    |
| ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------ | ------------------------------------- |
| `ATCCWI0369` (`b5b1098b-f25b-44d4-aa0d-d1edbeb298d3`) | `MaximumConstructionPeriod = 0`, `MaximumMaintenancePeriod = 0` | Both `0` in `policy_car` | Annual cover → **18** / **12** months |

### Root cause

Legacy MSSQL uses **`0` as “not set”** for period columns. The original export used:

```sql
COALESCE(pc.MaximumConstructionPeriod, 18)
```

`COALESCE` only replaces `NULL`, not `0`. The mapper then persisted `0`, which fails rebuild validation (`z.coerce.number().int().positive()`) and shows as empty/invalid in the wizard.

### Fix (implemented)

1. **Export SQL** — `NULLIF(..., 0)` before `COALESCE`, with cover-type-aware construction default.
2. **Mapper** — `positiveInt()` treats `≤ 0` as missing.
3. **Backfill** — `npm run db:repair:policy-periods -- --env=local` for already-loaded rows.

### Default rules (match new-policy wizard)

| Cover type     | `coverTypeId` | Max construction (months) | Max maintenance (months) |
| -------------- | ------------- | ------------------------- | ------------------------ |
| Annual         | 1             | 18                        | 12                       |
| Single project | 2             | 12                        | 12                       |
| Owner builder  | 3             | 12                        | 12                       |

### Local audit (pre-repair)

| Check                                        | Count / total |
| -------------------------------------------- | ------------- |
| Migrated policies                            | 5,101         |
| `maximum_construction_period ≤ 0`            | 3,585 (70%)   |
| `maximum_maintenance_period ≤ 0`             | 3,604 (71%)   |
| Both periods = 0                             | 3,585         |
| Valid construction + maintenance already set | 1,516         |

By cover type (policies with bad construction period):

| `coverTypeId`     | Total | Bad construction | Bad maintenance |
| ----------------- | ----- | ---------------- | --------------- |
| 1 (Annual)        | 4,450 | 3,109            | 3,109           |
| 2 (Single)        | 501   | 347              | 350             |
| 3 (Owner builder) | 150   | 129              | 145             |

---

## Required wizard fields vs migration coverage

Fields marked **Required** must be present and valid for a taken policy in the rebuild app (`carPolicySchema`).

| Rebuild field                           | Wizard label                       | Required            | Legacy source                         | Migration status                                            |
| --------------------------------------- | ---------------------------------- | ------------------- | ------------------------------------- | ----------------------------------------------------------- |
| `insurerCode`                           | Insurer                            | Yes                 | `Policy.UnderwriterCode`              | OK — default `ATC`                                          |
| `insuredName`                           | Insured Name                       | Yes                 | `PolicyCAR.InsuredName`               | OK                                                          |
| `coverTypeId`                           | Type of Cover                      | Yes                 | `PolicyCAR.CoverType`                 | OK                                                          |
| `annualCoverTypeId`                     | Annual Type of Cover               | When cover = Annual | Not in legacy export                  | **Derived:** set to `1` when `coverTypeId = 1`, else `null` |
| `policyCategoryId`                      | Policy Category                    | Yes                 | `Policy.PolicyAction`                 | OK — `NEW`→1, `RWL`→2                                       |
| `policyNumber`                          | Policy Number                      | Renewal only        | `Policy.PolicyNumber`                 | OK — deduped on collision                                   |
| `siteAddress`                           | Site Address                       | Optional            | `PolicyCAR.SiteAddress`               | OK — may be empty                                           |
| `estimatedTurnover`                     | Estimated Turnover / Project Value | Yes                 | `PolicyCAR.EstimatedTurnover`         | OK — `0` allowed as stored value                            |
| `postcode`                              | Postcode                           | Yes                 | `PolicyCAR.Postcode`                  | OK                                                          |
| `stateId`                               | State                              | Yes                 | `PolicyCAR.State` → code map          | OK — ACT/NSW/… → 1–8                                        |
| `businessActivities`                    | Business Activities                | Yes                 | `PolicyCAR.BusinessDescriptionText`   | OK                                                          |
| `insuredContracts`                      | Insured Contracts                  | Yes                 | `PolicyCAR.InsuredContracts`          | OK                                                          |
| `geographicalScopes`                    | Geographical Scope                 | Optional*           | `PolicyCAR.GeographicalScope`         | OK — *required in legacy Step 1                             |
| `maximumConstructionPeriod`             | Maximum Construction Period        | Yes                 | `PolicyCAR.MaximumConstructionPeriod` | **Fixed** — see above                                       |
| `maximumMaintenancePeriod`              | Maximum Maintenance Period         | Yes                 | `PolicyCAR.MaximumMaintenancePeriod`  | **Fixed** — see above                                       |
| `dateStart`                             | Policy From Date                   | Yes                 | `Policy.InceptionDate`                | OK                                                          |
| `dateEnd`                               | Policy End Date                    | Yes                 | `Policy.ExpiryDate`                   | OK                                                          |
| `hasExistingContractWorksCover`         | Current CW/L policy?               | Yes                 | `PolicyCAR.HoldCurrentContractWorks`  | OK                                                          |
| `currentInsurer`                        | Current insurer                    | When “Yes” above    | `PolicyCAR.CurrentInsurer`            | OK                                                          |
| `contractWorksSumInsured`               | Contract Works                     | Yes                 | `PolicyCAR.Section1Value`             | OK — `0` is valid                                           |
| `displayHomes`                          | Display Homes                      | Yes                 | `PolicyCAR.DisplayHomes`              | OK                                                          |
| `existingStructure`                     | Existing Structures                | Yes                 | `PolicyCAR.ExistingStructures`        | OK                                                          |
| `plantEquipment`                        | Plant & Equipment                  | Yes                 | `PolicyCAR.PlantEquipment`            | OK                                                          |
| `liabilityLimitBand`                    | Limit of Liability                 | Yes                 | `PolicyCAR.Section2Value`             | OK — default band 1                                         |
| `claimsCountLast3Years`                 | Claims last 3 years                | Yes                 | `PolicyCAR.NumberOfClaimLast3Years`   | OK                                                          |
| `anyClaimsExceed20k`                    | Claims > $20k                      | Yes                 | `PolicyCAR.AnyClaimsExceed20k`        | OK                                                          |
| `declarationConfirmed`                  | General Disclosure                 | Yes on save         | `PolicyCAR.Confirmation`              | **76 policies** still `false` — see note                    |
| Sub-limits (12 keys)                    | Sub-limits of Liability            | Yes                 | `PolicyCARSubLimitWording.*`          | OK — empty string if no row                                 |
| Excesses (12 keys + notes)              | Excesses                           | Yes                 | `PolicyCARExcess.*`                   | OK — band relocation in mapper                              |
| `excludedContracts1–3`                  | Excluded contracts                 | Optional            | `PolicyCARSubLimitWording`            | OK                                                          |
| `selectedWordingIds` / `customWordings` | Additional wording                 | Optional            | `PolicyCARWording` SQL slice          | OK                                                          |

### Note: `declarationConfirmed`

Legacy `PolicyCAR.Confirmation = 0` was stored as `false` for policies that pre-dated the checkbox or never captured it. **Repair sets `declaration_confirmed = true`** for all migrated rows where legacy left it false, so the wizard passes full validation. Future imports use the same rule when `policyStatusId !== 1` (Taken / Not taken), and the repair script covers Pending.

### Repair script (all required fields)

`npm run db:repair:migrated-policies -- --env=local`

Backfills using app defaults from `app/lib/reference-data.ts`:

| Field / area                | Default source                                                                    |
| --------------------------- | --------------------------------------------------------------------------------- |
| `maximumConstructionPeriod` | 18 (Annual) / 12 (Single, Owner Builder)                                          |
| `maximumMaintenancePeriod`  | 12                                                                                |
| `declarationConfirmed`      | `true` when legacy false                                                          |
| `annualCoverTypeId`         | 1 when Annual and missing                                                         |
| `businessActivities`        | `referenceData.defaultTexts.businessActivities`                                   |
| `insuredContracts`          | Annual transfer / single project text                                             |
| `geographicalScopes`        | Annual scope or site address                                                      |
| `subLimits`                 | `defaultSubLimits.annual` or `.ownerBuilder`                                      |
| `appExtras.excesses`        | `referenceData.defaultExcesses` for visible band fields                           |
| `excludedContracts1–3`      | `referenceData.defaultTexts`                                                      |
| `postcode`                  | First 4 digits if invalid (e.g. `35000` → `3500`)                                 |
| `dateEnd`                   | Capped to 18 months (Annual/Single) or 12 months (Owner Builder) from `dateStart` |

Legacy-only period fix (superseded): `npm run db:repair:policy-periods`

---

## Full column mapping

### `Policy` → `policy`

| Legacy (`dbo.Policy`) | Export alias     | Postgres `policy`    | Transform                                 |
| --------------------- | ---------------- | -------------------- | ----------------------------------------- |
| `PolicyId`            | `policyId`       | —                    | UUID via `legacyPolicyUuid()`             |
| `ClientId`            | `clientId`       | `client_id`          | UUID via `legacyClientUuid()`             |
| `PolicyNumber`        | `policyNumber`   | `policy_number`      | Renewal dupes: year → month → date → hash |
| `PolicyAction`        | `policyAction`   | `policy_category_id` | `RWL` → 2, else 1                         |
| —                     | —                | `policy_type_id`     | Always `1` (CAR)                          |
| —                     | `policyStatusId` | `policy_status_id`   | From `PolicyCAR.Status`                   |
| —                     | `postcode`       | `postcode`           |                                           |
| —                     | `stateCode`      | `state_id`           | Code → integer 1–8                        |
| `InceptionDate`       | `dateStart`      | `date_start`         | Date only                                 |
| `ExpiryDate`          | `dateEnd`        | `date_end`           | Date only                                 |
| `UnderwriterCode`     | `insurerCode`    | `insurer_code`       | Default `ATC`                             |
| `CreatedDate`         | `createdWhen`    | `created_when`       |                                           |
| —                     | —                | `created_by`         | `migrate:mssql`                           |
| —                     | —                | `is_draft`           | `false` when premium present              |

### `PolicyCAR` → `policy_car` (risk & limits)

| Legacy (`dbo.PolicyCAR`)    | Export alias                    | Postgres column                     | Transform / default                  |
| --------------------------- | ------------------------------- | ----------------------------------- | ------------------------------------ |
| `CoverType`                 | `coverTypeId`                   | `cover_type_id`                     |                                      |
| —                           | —                               | `annual_cover_type_id`              | `1` if annual, else `null`           |
| `SiteAddress`               | `siteAddress`                   | `site_address`                      |                                      |
| `InsuredName`               | `insuredName`                   | `insured_name`                      |                                      |
| `EstimatedTurnover`         | `estimatedTurnover`             | `estimated_turnover`                |                                      |
| `BusinessDescriptionText`   | `businessActivities`            | `business_activities`               |                                      |
| `InsuredContracts`          | `insuredContracts`              | `insured_contracts`                 |                                      |
| `GeographicalScope`         | `geographicalScopes`            | `geographical_scopes`               |                                      |
| `PlantEquipment`            | `plantEquipment`                | `plant_equipment`                   |                                      |
| `ExistingStructures`        | `existingStructure`             | `existing_structure`                |                                      |
| `DisplayHomes`              | `displayHomes`                  | `display_homes`                     |                                      |
| `NumberOfClaimLast3Years`   | `claimsCountLast3Years`         | `claims_count_last_3_years`         |                                      |
| `AnyClaimsExceed20k`        | `anyClaimsExceed20k`            | `any_claims_exceed_20k`             |                                      |
| `Confirmation`              | `declarationConfirmed`          | `declaration_confirmed`             |                                      |
| `Section1Value`             | `contractWorksSumInsured`       | `contract_works_sum_insured`        |                                      |
| `Section2Value`             | `liabilityLimitBand`            | `liability_limit_band`              | Default 1                            |
| `HoldCurrentContractWorks`  | `hasExistingContractWorksCover` | `has_existing_contract_works_cover` |                                      |
| `CurrentInsurer`            | `currentInsurer`                | `current_insurer`                   |                                      |
| `MaximumConstructionPeriod` | `maximumConstructionPeriod`     | `maximum_construction_period`       | **`NULLIF(0)` + cover-type default** |
| `MaximumMaintenancePeriod`  | `maximumMaintenancePeriod`      | `maximum_maintenance_period`        | **`NULLIF(0)` + default 12**         |
| Premium columns             | `contractWorks*`, `liability*`  | matching `policy_car` columns       | See premium section                  |
| `DoNotCalculate`            | `manualTaxOverride`             | `manual_tax_override`               |                                      |

### Sub-limits → `policy_car.sub_limits` (jsonb)

| Legacy (`PolicyCARSubLimitWording`) | App key                                             |
| ----------------------------------- | --------------------------------------------------- |
| `RemovalOfDebris`                   | `removalOfDebris`                                   |
| `ExpeditingExpenses`                | `expeditingExpenses`                                |
| `ProfessionalFees`                  | `professionalFees`                                  |
| `MitigationExpenses`                | `mitigationExpenses`                                |
| `SearchAndLocateCosts`              | `searchAndLocateCosts`                              |
| `PlantHireCharges`                  | `plantHireCharges`                                  |
| `ClaimsPreparationCosts`            | `claimsPreparationCosts`                            |
| `GovernmentCosts`                   | `governmentCosts`                                   |
| `InflationProtection`               | `inflationProtection`                               |
| `EmployeesProperty`                 | `employeesProperty`                                 |
| `MaterialsInOffSiteStorage`         | `materialsInOffSiteStorage`                         |
| `Transit`                           | `transit`                                           |
| `ExcludedContracts1–3`              | `excludedContracts1–3` (also top-level on `Policy`) |

### Excesses → `policy.excesses` (jsonb on policy row)

| Legacy (`PolicyCARExcess`) | App key                 |
| -------------------------- | ----------------------- |
| `ExcessSection1A–E`        | `excessSection1A–E`     |
| `ExcessSection2A–F`        | `excessSection2A–F`     |
| `ExcessAdditionalNotes`    | `excessAdditionalNotes` |

Excess values are relocated to the active turnover band in `mapLegacyExcesses()`.

### Premium & rating → `policy_car` + jsonb extras

Stored on `policy_car` numeric columns and `policy` jsonb (`rating`, `premiumManualKeys`, etc.). Mapped 1:1 from legacy column names in `scripts/sql/legacy/policies.sql` lines 40–100.

### Adjustment → `policy_car_adjustment`

When `PolicyCAR.Adjusted = 1`, adjustment deltas load into `policy_car_adjustment` via `buildCarAdjustmentRecord()`.

### Wordings & notes (separate SQL slices)

| Legacy table       | Target                                        |
| ------------------ | --------------------------------------------- |
| `PolicyCARWording` | `selectedWordingIds` + `customWordings` jsonb |
| `PolicyNote`       | `policy.notes` jsonb                          |

### Documents (separate slice)

| Legacy                             | Target                                                  |
| ---------------------------------- | ------------------------------------------------------- |
| `PolicyDocument` + filesystem PDFs | R2 `policy-documents` bucket + `policy.documents` jsonb |

---

## ID mapping

| Legacy integer ID    | Postgres                                                      |
| -------------------- | ------------------------------------------------------------- |
| `Policy.PolicyId`    | Deterministic UUID `legacyPolicyUuid(policyId)`               |
| `Client.ClientId`    | Deterministic UUID `legacyClientUuid(clientId)`               |
| Account manager code | Fixed map `legacy-account-manager-map.mts` (6 canonical rows) |

---

## Operations checklist

| Step                                       | Command                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| Re-export from MSSQL (optional)            | `npm run db:export:legacy`                                  |
| Full re-migrate                            | `npm run db:migrate:legacy -- --env=local --replace`        |
| Backfill all required fields (existing DB) | `npm run db:repair:migrated-policies -- --env=local`        |
| Backfill periods only                      | `npm run db:repair:policy-periods -- --env=local`           |
| Dry-run backfill                           | `npm run db:repair:policy-periods -- --env=local --dry-run` |
| UAT / prod backfill                        | Add `--confirm`                                             |

After backfill, verify a sample policy:

```sql
SELECT policy_number, cover_type_id, maximum_construction_period, maximum_maintenance_period
FROM policy p JOIN policy_car pc USING (policy_id)
WHERE policy_id = 'b5b1098b-f25b-44d4-aa0d-d1edbeb298d3';
```

Expected: `18` / `12` for annual cover type 1.

---

## Related files

- Export SQL: `scripts/sql/legacy/policies.sql`
- Mapper: `scripts/lib/legacy-policy-mapper.mts`
- Load: `scripts/lib/load-legacy-domain.mts`
- Repair (all fields): `scripts/repair-migrated-policies.mts`
- Repair helpers: `scripts/lib/repair-migrated-policy-fields.mts`
- Repair (periods only): `scripts/repair-migrated-policy-periods.mts`
- Rebuild validation: `app/lib/zod/policy-car.ts`
- Legacy validation reference: `_archive/specs/CAR_FORM_VALIDATION.md`
