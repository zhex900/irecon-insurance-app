# Database Schema Changelog

**Canonical schema:** [`db.txt`](./db.txt)  
**Baseline (initial draft):** [`db.txt.original`](./db.txt.original)

This is a **greenfield** rebuild — no production migration from legacy ASP.NET. `db.txt.original` is the first schema draft (legacy-shaped hierarchy and adjustment model). This document is the **diff: original → current**, with reasons.

---

## Naming clarity (aligned with legacy `script.sql` meaning)

Schedule **Section 1 / Section 2** remain labels on PDFs and broker UI. Schema columns use domain names instead.

| Area | Old (draft / legacy jargon) | Current |
|------|----------------------------|---------|
| AR entity | `AR` | **`AuthorisedRepresentative`** |
| Fee catalogue | `Fee` / `FeeName` | **`BrokerFeeSchedule`** / **`BrokerFeeScheduleLine`** |
| Policy fee line | `PolicyFeeId` / `FeeLineId` | **`LineNumber`** (1, 2, … within policy; **not** a surrogate PK / not FK to schedule) |
| Contract works cover | `Section1*` | **`ContractWorks*`** (e.g. `ContractWorksBasePremium`, `ContractWorksSumInsured`) |
| Liability cover | `Section2*` | **`Liability*`** (e.g. `LiabilityBasePremium`, `LiabilityLimitBand`) |
| Liability band | `Section2Value` (decimal-looking) | **`LiabilityLimitBand`** int `1`/$10M, `2`/$20M, `3`/not insured |
| Base before/after min | `*BeforeBasePremium` / `*TrueBasePremium` | **`*CalculatedBasePremium`** / **`*BasePremium`** |
| Plant thresholds | `PlantMinPrem` / `PlantMaxPrem` | **`PlantValueMin`** / **`PlantValueMax`** |
| Tax lock flag | `DoNotCalculate` | **`ManualTaxOverride`** |
| Existing CW cover | `HoldCurrentContractWorks` | **`HasExistingContractWorksCover`** |
| Claims question | `NumberOfClaim` | **`ClaimsCountLast3Years`** |
| Declaration | `Confirmation` | **`DeclarationConfirmed`** |
| Price tables | `PriceFile*` | **`Price*`** (e.g. `Price`, `PriceESL`, `PriceCAR`, `PriceTerrorism*`; FKs `PriceId`, `PriceESLId`, …) — dropped legacy “file” |
| Excess catalogue | `Heading`, `LiabilityMil`, `Section` | **`IsGroupHeading`**, **`LiabilityLimitMillions`**, **`CoverSection`** |
| Status / business | `CARStatus`, `PolicyAction` | **`PolicyStatus`**, **`BusinessType`** (earlier) |
| Static PDFs | `FixedPdf` | **`LibraryDocument`** (earlier) |

**`LineNumber`:** On `PolicyFee`, composite PK `(PolicyId, LineNumber)`. Values are `1`, `2`, `3`… within that policy’s fee list — not a global surrogate key and not an FK to `BrokerFeeSchedule`.

PDF/UI may still say “Section 1 / Section 2”; columns map as Contract Works / Liability.

---

## Summary

| | Original | Current |
|--|----------|---------|
| Tables | 37 | 44 |
| Policy hierarchy | `Client` → `PolicyHeader` → `PolicyPeriod` → `Policy` → `PolicyCAR` | `Client` → `Policy` → `PolicyCAR` |
| Adjustments | One row + absolute mirrors; `Adjusted` bit + `TotalSection*` on `PolicyCAR` | Many children; **deltas** only; Draft/Applied |
| Fees total | `OriginalCombinedFee` snapshot | Derived from `PolicyFee` lines |
| Invoice total on spine | `PolicyHeader.TotalInvoicePremium` | Dropped — use `PolicyCAR.OriginalTotalPremium` |
| Documents / settings | Not modeled | Templates, `LibraryDocument`, `PolicyDocument`, `AppSetting`, `User` |

---

## 1. Tables removed

| Table | Reason |
|-------|--------|
| **`PolicyHeader`** | Thin wrapper (`ClientId` + `TotalInvoicePremium`). Client link and dates belong on `Policy`. |
| **`PolicyPeriod`** | Extra layer for Phase 1 CAR (one term per transaction). `DateStart` / `DateEnd` moved onto `Policy`. |
| **`PolicyCARSubLimit`** | 1:1 text bag → `PolicyCAR.SubLimits` jsonb snapshot. Catalogue **`CARSubLimit`** kept. |
| **`PolicyCARWording`** | Child rows → `PolicyCAR.Wordings` jsonb array. Catalogue **`CARWording`** kept. |

---

## 2. Tables added

| Table | Reason |
|-------|--------|
| **`User`** | App login profile (`auth.users` uuid); broker/admin + optional `AuthorisedRepresentativeId` scope. |
| **`ActivityLog`** | Structured system audit (FR-AUD-04). Kept **separate** from `PolicyNote` (broker notes). |
| **`AdjustmentStatus`** | Lookup: Draft / Applied. |
| **`AnnualCoverType`** | Transfer / Contract Commencing when cover type is Annual (FR-CAR-06). |
| **`AppSetting`** | Key/value Settings (e.g. org logo JSON) — replaces ad-hoc assets. |
| **`DocumentTemplate`** | PDF slot identity (`DocumentTypeCode` × `CoverTypeId`). |
| **`DocumentTemplateVersion`** | Versioned pdfme template JSON; one active per slot. |
| **`PolicyDocument`** | Append-only metadata for generated PDFs in R2. |
| **`LibraryDocument`** / **`LibraryDocumentAssignment`** | Shared static PDF library + cover/state rules (`CARADDIT`). Not the same as `PolicyDocument` (per-policy issued copies). Renamed from draft `FixedPdf` / `FixedPdfAssignment`. |
| **`EmailLogDocument`** | Junction: which `PolicyDocument`s were attached to an email send. |

---

## 3. Hierarchy & `Policy`

### Original

```
Client → PolicyHeader → PolicyPeriod → Policy → PolicyCAR
```

### Current

```
Client → Policy → PolicyCAR (1:1)
```

| Change | Reason |
|--------|--------|
| Drop header / period | Phase 1 does not need multi-period nesting; fewer joins for lists. |
| `Policy.ClientId` | Direct client ownership (was via header). |
| `Policy.DateStart` / `DateEnd` | Inception / expiry (from period). Expired = today > `DateEnd`. |
| Drop `DateEffective` | Redundant with `DateStart` for CAR. |
| Drop spine `TotalInvoicePremium` | Product money lives on `PolicyCAR.OriginalTotalPremium`; lists join 1:1 `PolicyCAR`. |
| `Policy.PolicyStatusId` | List/filter without joining product tables. Generic lifecycle (renamed from draft `CARStatusId`). |
| `Policy.TakenAt` / `TakenBy` | Commit audit next to status. Also report **“date approved”** — no `DateApproved` column. |
| `BusinessTypeId` | New vs Renewal (lookup `BusinessType`; renamed from draft `PolicyActionId`). |
| `InsurerCode` | Underwriter code on transaction. |
| `CreatedWhen` / `CreatedBy` / `UpdatedWhen` | Audit on spine. |

Keep **`Policy` ≠ `PolicyCAR`**: shared spine vs CAR product columns (future products e.g. HCP).

---

## 4. `PolicyCAR`

| Change | Reason |
|--------|--------|
| **Move** status onto `Policy` as **`PolicyStatusId`** | Single SoT; was draft `CARStatus` / `CARStatusId` — renamed so spine is product-agnostic (Pending / Taken / Not taken). |
| **Drop** `OriginalCombinedFee` | Fees SoT = `PolicyFee`; combined = `sum(Fee)+sum(FeeGst)`. |
| **Drop** `Adjusted` + all `TotalSection*` / `TotalTotalPremium` | Legacy in-place adjustment mirrors; superseded by child adjustments + deltas. |
| **Drop** `TotalContractWorksTerrorismPremium` | Derive from stored terror components when needed. |
| **Add** `SubLimits` (jsonb) | Replaces `PolicyCARSubLimit`. |
| **Add** `Wordings` (jsonb array) | Replaces `PolicyCARWording`. |
| **Add** `AnnualCoverTypeId` | Replaces free-text annual “type of cover”. |
| **Add** `PriceTerrorismId` / `PricePlantId` | Pricing source FKs (FR-PRICE-04) — were incomplete on original. |
| **`LiabilityLimitBand`**: `decimal` → **`int`** | Liability band `1`/$10M, `2`/$20M, `3`/not insured — not money. |
| **`OriginalTotalPremium`** kept | Bind-time total (S1 + S2 + fees). Effective after adj = this + latest Applied `DeltaTotalPremium`. |

---

## 5. `PolicyCARAdjustment`

| Original | Current | Reason |
|----------|---------|--------|
| Implicit 1:1 (`PolicyId` only) | Surrogate `PolicyCARAdjustmentId` + `AdjustmentSequence` | Multiple adjustments per policy (A-1, A-2, …). |
| Absolute `AdjustedSection*` / `AdjustedTotalPremium` | **`Delta*`** columns only | Absolutes = `PolicyCAR` originals + deltas; no dual write. |
| `AdjustedDate` | `CreatedWhen` / `CreatedBy` / `AppliedWhen` / `AppliedBy` | Draft vs Applied audit. |
| No status | `AdjustmentStatusId` (Draft / Applied) | Draft editable; Applied immutable; at most one Draft. |
| — | Drop absolute fee mirror | Fees not re-snapshotted on turnover adjustment. |

**Effective premium:** `PolicyCAR.OriginalTotalPremium` + latest **Applied** `DeltaTotalPremium`.

Display label `A-{n}` is derived in app (not stored).

---

## 6. Fees, notes, email

| Change | Reason |
|--------|--------|
| **`PolicyFee`** unchanged shape; composite PK `(PolicyId, LineNumber)` | Line items = fee SoT. |
| No combined-fee column on `PolicyCAR` | Avoid denorm drift. |
| **`PolicyNote.PolicyNoteId`** PK | Multiple notes per policy (FR-POL-06). |
| Keep **`PolicyNote`** + **`ActivityLog`** | Broker typed notes vs system audit — do not merge for v1. |
| **`EmailLog`**: `From`/`To` → `FromAddress`/`ToAddress`; add `PolicyId` | Reserved words + policy-scoped sends. |
| **`EmailLogDocument`** | FR-DOC-03 attachments. |

---

## 7. Constraints & types (current)

Declared for first Postgres migration (DBML `indexes { (…) [pk] }` for composites):

| Object | Constraint |
|--------|------------|
| `PolicyNote` | PK `PolicyNoteId` |
| `EmailLogDocument` | PK `(EmailLogId, PolicyDocumentId)` |
| `PolicyCARExcess` | PK `(PolicyId, CARExcessId)` |
| `PolicyFee` | PK `(PolicyId, LineNumber)` |
| `BrokerFeeScheduleLine` | PK `(BrokerFeeScheduleId, SortOrder)` |
| `PriceCAR` | PK `(PriceId, CoverTypeId, TurnoverMin)` |
| `PriceTerrorismPostCode` | PK `(PriceTerrorismRateId, Postcode)` |
| `PolicyCARAdjustment` | `UNIQUE (PolicyId, AdjustmentSequence)`; partial unique one Draft per policy |
| `DocumentTemplate` | `UNIQUE (DocumentTypeCode, CoverTypeId)` (`CoverTypeId` null for CARADJUST) |
| `DocumentTemplateVersion` | `UNIQUE (DocumentTemplateId, VersionNumber)`; partial unique one `IsActive` |
| `PolicyCAR.LiabilityLimitBand` | `CHECK IN (1, 2, 3)` |

---

## 8. Unchanged (intentionally)

Reference / pricing catalogues largely same as original: `AuthorisedRepresentative`, `AccountManager`, `Client`, `EntityType`, `State`, `CoverType`, `PolicyStatus` (was `CARStatus`), `CARExcess`, `CARSubLimit`, `CARWording`, `BrokerFeeSchedule`/`BrokerFeeScheduleLine`, `Price*` tree, `PolicyType` / `PolicyNumber` / **`BusinessType`** (was `PolicyAction`), `PolicyFee` columns, `PolicyCARExcess`.

`AccountManager.ARNumber` **kept** — legacy PDF merge `AccountManagerARNumber` (not the same as `AR.ARNumber`).

---

## 9. Explicit non-goals / deferred

| Item | Notes |
|------|--------|
| Merge `Policy` + `PolicyCAR` | No — multi-product spine. |
| Merge `PolicyNote` + `ActivityLog` | No for v1. |
| `DateApproved` column | Use `Policy.TakenAt`. |
| `TerrorismTier` on `PolicyCAR` | Optional; rate + terror price FK already stored. |
| Soft-delete `AuthorisedRepresentative` | Optional later. |
| Mutable `EffectivePremium` on `Policy` | No — compute from original + latest Applied delta. |

---

## 10. Related docs

- [CAR_INSURANCE_APP_SPEC.md](./CAR_INSURANCE_APP_SPEC.md) — FRs  
- [CAR_PRICING_FORMULAS.md](./CAR_PRICING_FORMULAS.md) — bind + adjustment math  
- [CAR_INSURANCE_TECH_SPEC.md](./CAR_INSURANCE_TECH_SPEC.md) — implementation  

When changing schema further, update **`db.txt`** and add a short section here under “Current vs previous” (or append a dated note), keeping this file as the original→current map.
