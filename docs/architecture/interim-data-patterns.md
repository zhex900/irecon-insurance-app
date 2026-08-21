# Interim data patterns

Temporary schema and storage choices used during Phase 1 rebuild and legacy migration. Use this doc when planning normalization work — what to promote to typed columns/tables, what can stay as JSONB, and what is migration-only.

**Related:** [refactor-to-production.md](./refactor-to-production.md) (data decision matrix), [legacy-db-migration/README.md](../legacy-db-migration/README.md), [domains/migration/legacy-policy-field-mapping.md](../domains/migration/legacy-policy-field-mapping.md).

**Last updated:** 2026-08-21

---

## Summary

| Pattern                     | Location                                   | Status                                                             | Suggested next step                                      |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------- |
| `app_extras` JSONB bag      | `policy_car.app_extras`                    | **Removing** — migration `20260821100000_normalize_app_extras.sql` | Apply migration; verify mapper/services use child tables |
| Typed JSONB on `policy_car` | `sub_limits`, `wordings`, `excesses`, etc. | Active interim                                                     | Keep unless query/validation needs rows                  |
| `app_snapshot`              | `policy_car_adjustment.app_snapshot`       | Active interim                                                     | Redesign with Stage 2 adjustments                        |
| Static lookups              | `app/lib/reference-data.ts`                | Active interim                                                     | Migrate catalogues to DB tables                          |
| `is_draft`                  | `policy.is_draft`                          | Active interim                                                     | Derive from status + premium                             |
| Denormalized rating         | `policy_car.*` rate columns                | Stable                                                             | Optional `policy_car_rating` table later                 |
| Document fallbacks          | `policy_document.pdf_base64`, `content`    | Active interim                                                     | R2-only when legacy parity allows                        |
| Legacy migration IDs        | `legacyPolicyUuid`, deduped policy numbers | Migration-era                                                      | Keep for re-import; not runtime product design           |
| Repair scripts              | `db:repair:migrated-policies`, etc.        | Migration-era                                                      | Run after imports; document in runbooks                  |
| Client session cache        | `sessionStorage`, wizard step memory       | Ephemeral UX                                                       | No DB work needed                                        |

---

## 1. `policy_car.app_extras` (catch-all JSONB bag)

**Was:** Single JSONB column holding unrelated policy data until proper schema existed.

**Held:**

- Documents, notes, selected wording IDs
- Per-policy excesses, referral reasons, premium manual keys
- Rating extras (`terrorismTier`, `isTerrorismRateExist`)
- Excluded contracts, combined broker fee
- Custom wordings (when `wordings` column empty)

**Normalization (in progress):**

Migration `supabase/migrations/20260821100000_normalize_app_extras.sql`:

1. Adds typed columns on `policy_car` (`excluded_contracts_*`, `terrorism_tier`, `premium_manual_keys`, `referral_reasons`, `excesses`, …)
2. Creates child tables: `policy_document`, `policy_note`, `policy_car_selected_wording`
3. Backfills from `app_extras`
4. Drops `app_extras`

**App touchpoints after migration:**

- `app/lib/db/schema.ts` — no `appExtras` column
- `app/lib/db/policy-mapper.ts` — reads/writes child tables
- `app/lib/services/policy/data.service.ts`, `app/lib/services/policies/list.service.ts`

**Legacy docs to update when done:**

- `docs/legacy-db-migration/documents.md` — still references `app_extras.documents`
- `docs/legacy-db-migration/README.md` — document target is now `policy_document`

---

## 2. Remaining typed JSONB on `policy_car`

These are **not** catch-all bags. Each column has a fixed TypeScript shape and Zod validation. Lower priority to normalize unless you need SQL queries, constraints, or row-level history.

| Column                | Type / shape                       | Source (legacy)                | Notes                                                              |
| --------------------- | ---------------------------------- | ------------------------------ | ------------------------------------------------------------------ |
| `sub_limits`          | `Record<string, string>` (12 keys) | `PolicyCARSubLimitWording`     | Defaults from `referenceData.defaultSubLimits`                     |
| `wordings`            | Custom wording array               | `PolicyCARWording` (free text) | Catalogue picks → `policy_car_selected_wording` + `car_wording`    |
| `excesses`            | `CarExcesses`                      | `PolicyCARExcess`              | Catalogue → `policy_car_excess_default`; per-policy overrides here |
| `premium_manual_keys` | `string[]`                         | Premium Breakdown UI           | Tracks manually edited premium fields                              |
| `referral_reasons`    | `string[]`                         | Referral engine                | Could become child table if reporting needs it                     |

**When to normalize further:**

- Reporting/filtering on individual sub-limits or excess lines in SQL
- Strict FK from wordings to catalogue
- Audit trail per field change

---

## 3. `policy_car_adjustment.app_snapshot`

**Location:** `policy_car_adjustment.app_snapshot` (JSONB, nullable)

**Purpose:** Full adjustment UI snapshot (breakdown + absolute totals) for Stage 1 end-of-term adjustment. Documented in schema as interim until Stage 2 redesign.

**Stage 1 model (legacy parity):**

- One adjustment row per policy; save overwrites
- Original Taken premium on `policy_car` is immutable
- Effective premium = original + delta columns + snapshot for display

**Future work (Stage 2):**

- Redesign adjustment lifecycle (draft/history, expiry gates — see `_archive/specs/CAR_SAVE_VALIDATION.md`)
- Replace or shrink `app_snapshot` with typed columns or versioned adjustment rows
- See [car-premium-formulas.md §7](../domains/pricing/car-premium-formulas.md) for formula context

**Code:** `app/lib/db/policy-mapper.ts` (`adjustmentToDomain` / save path), `app/lib/services/policy/adjustment.service.ts`

---

## 4. Static lookups — `reference-data.ts`

**Location:** `app/lib/reference-data.ts`

**Still static in code (not DB):**

- States, cover types, annual cover types, policy categories/statuses
- Liability limit bands, insurers
- Default sub-limits, default excesses, default wizard text snippets

**Already from DB via `getReferenceDataAsync`:**

- Account managers, authorised representatives (wholesale brokers)
- Fee names (`broker_fee_schedule`)

**Rule (from refactor-to-production):** If the app reads it on every request, prefer Postgres over repo JSON — except pdfme template JSON (already in `app_document_template_version`).

**Migration approach:**

1. Add lookup tables matching existing integer IDs (preserve FK compatibility)
2. Seed from current `reference-data.ts` values
3. Switch `getReferenceDataAsync` / loaders to DB; shrink static export
4. Keep compile-time constants only for IDs used in business logic if needed

**Consumers:** Routes under `app/routes/_app/`, `app/lib/services/reference.service.ts`, repair scripts (`db:repair:migrated-policies` uses defaults from here)

---

## 5. Policy wizard phase (UI)

**Location:** `derivePolicyPhase()` in `app/components/policies/wizard/shared/policy-phase.ts`, exposed via `PolicyPhaseProvider`.

**Purpose:** Single derived lifecycle for wizard chrome and edit gates — replaces the overlapping `wizardMode`, `readOnly`, `fieldsLocked`, and `hasSubmittedOnce` flags.

| Phase                 | When                                       | UI                                    |
| --------------------- | ------------------------------------------ | ------------------------------------- |
| `new`                 | `isDraft` and (`?new=1` or no premium yet) | Primary border; optional Draft pill   |
| `pending`             | Submitted, status Pending, editable        | Warning border; status badge Pending  |
| `taken` / `not-taken` | Saved terminal status                      | Success / muted border; locked fields |

**Inputs:** persisted `policy` (status + `isDraft`), URL `isNew`, live form `policyStatusId` (terminal confirm preview only).

**Not merged into phase:** draft autosave (`hasUnsavedChanges`), submit fingerprint gate, `freshSteps` URL flag.

**Future:** drop `is_draft` column and treat `phase === "new"` as `Pending && !submitted_at` (see §6).

---

## 6. `policy.is_draft`

**Location:** `policy.is_draft` (boolean, default `true`)

**Purpose:** App convenience for wizard flow — distinguishes unsaved new-policy drafts from submitted Pending policies. Comment in schema: _derive from `!premium` later_.

**Interactions:**

- Delete draft: Pending + `isDraft` only (`data.service.ts`)
- Save/recalculate preserves submitted state (`orchestration.service.ts`, `draft-merge.ts`)

**Future work:**

- Derive draft-ness from `policy_status_id === Pending && !hasPremium(policy_car)` (or explicit `submitted_at`)
- Drop column after all call sites updated

---

## 7. Denormalized rating on `policy_car`

**Not a JSON bag** — rating is stored as scalar columns on `policy_car` (`price_id`, `plant_rate`, `terrorism_rate`, `contract_works_applied_rate`, …).

**App type:** `RatingSnapshot` in `app/lib/db/types.ts`, assembled in `policy-mapper.ts` (`ratingFromRow`).

**History:** Part of rating lived in `app_extras.rating` during early migration; typed columns + `terrorism_tier` / `is_terrorism_rate_exist` replace that.

**Optional future:** `policy_car_rating` table or snapshot-at-taken if you need rate history separate from live lookup rates (adjustments already use frozen-rate math from stored premiums — see premium formulas §9).

---

## 8. Document storage fallbacks

**Table:** `policy_document`

| Field          | Role                                        | Target state                                         |
| -------------- | ------------------------------------------- | ---------------------------------------------------- |
| `r2_key`       | Canonical PDF in R2                         | Primary for migrated + generated docs                |
| `pdf_base64`   | Inline PDF (session / Excel export / email) | Drop when generation always uploads to R2            |
| `content`      | Plain text for legacy text-PDF builder      | Keep for text-only endorsements or drop if all pdfme |
| `merge_inputs` | pdfme merge field overrides                 | JSONB OK — shape varies by template                  |

**Code:** `app/lib/pdf/generate.ts`, `app/lib/services/email/send-policy-documents.server.ts`, `app/routes/api/policies.$policyId.documents.tsx`

---

## 9. Legacy migration mechanics (operational interim)

These are **not** product schema debt — they exist for idempotent MSSQL → Postgres import.

| Mechanism                | Location                                                          | Purpose                                    |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------ |
| Deterministic UUIDs      | `scripts/db/legacy/lib/legacy-id-map.mts`                         | `legacyPolicyUuid`, `legacyClientUuid`     |
| Policy number dedup      | `legacy-policy-mapper.mts`                                        | Suffix collisions (`-YYYY`, `-YYYY-MM`, …) |
| Document sync checkpoint | `_archive/data/legacy-documents-sync-state.json`                  | Resumable R2 upload                        |
| Export snapshot          | `_archive/data/legacy-export.json`                                | Offline document migration                 |
| Repair scripts           | `npm run db:repair:migrated-policies`, `db:repair:policy-periods` | Backfill broken legacy values              |

**When legacy import is complete:** Keep scripts for re-runs; no need to remove deterministic UUIDs (stable IDs are useful).

---

## 10. Client-side ephemeral storage

Not persisted domain data — no normalization task.

| Key pattern                  | File                                                           | Purpose                                    |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `car-policy-step:*`          | `wizard-step-memory.ts`                                        | Wizard step + max step per policy          |
| `car-policy-focus-section:*` | `wizard-step-memory.ts`                                        | Scroll/focus after navigation              |
| Reference session cache      | `reference-session-cache.ts`, `use-reference-session-fetch.ts` | Avoid repeat loader fetches in SPA session |

---

## Recommended priority for future normalization

1. **Finish `app_extras` removal** — apply migration, update legacy migration docs, smoke policy load/save/documents/notes/wordings.
2. **`reference-data.ts` → DB tables** — highest ongoing maintenance cost; enables admin editing of catalogues.
3. **Stage 2 adjustments** — replaces `app_snapshot` and single-row overwrite model.
4. **`is_draft` derivation** — small schema cleanup once lifecycle rules are stable.
5. **`policy_document` R2-only** — reduce row size and duplicate PDF bytes.
6. **Optional row normalization** — `sub_limits`, `excesses`, custom `wordings` only if reporting requires it.

---

## Checklist when closing an interim pattern

- [ ] Migration + backfill (if existing data)
- [ ] Drizzle schema + `policy-mapper.ts` + Zod schemas
- [ ] Services and API routes
- [ ] Legacy import mapper (`scripts/db/legacy/`) if affected
- [ ] Repair/seed scripts
- [ ] Docs: this file, legacy-db-migration, field mapping
- [ ] `npm run typecheck` + smoke affected routes
- [ ] No new static heavy imports in route graph ([performance.md](./performance.md))
