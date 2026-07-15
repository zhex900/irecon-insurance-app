# Database Schema Changelog

Canonical schema: [`db.txt`](./db.txt).

This is a **greenfield implementation** — there is no production database and **no data migration** from the legacy ASP.NET system. Schema changes are applied directly to `db.txt` and implemented fresh in the new app (e.g. Supabase migrations generated from this file).

[`db.txt.original`](./db.txt.original) is kept only as a **historical reference** to the initial schema draft (legacy-shaped adjustment model). It is not a migration source.

---

## 2026-07-15 — Immutable Taken policy + one-to-many adjustments

### Summary

Defined end-of-term adjustment storage so the **original Taken policy is immutable** and each adjustment is an **append-only child record** with **Draft** or **Applied** status. Supports unlimited applied adjustments before policy expiry.

**Reason:** An earlier draft of `db.txt` mirrored legacy ASP.NET behavior: a single `PolicyCARAdjustment` row per policy (no primary key) and adjustment deltas stored on `PolicyCAR` (`Adjusted`, `TotalSection*`, `TotalTotalPremium`). That shape is unsuitable for a clean rebuild because it cannot support:

- freezing the original premium snapshot after Taken commit,
- multiple adjustments per policy (e.g. A-1, A-2),
- draft adjustments that do not affect effective premium,
- computing effective premium as **original + latest Applied delta**,
- a clear audit trail for documents and compliance.

The target design is documented in [CAR_INSURANCE_APP_SPEC.md §6.9](./CAR_INSURANCE_APP_SPEC.md#69-policy-state-and-lifecycle).

---

### `PolicyCAR` — columns not in target schema

These existed in `db.txt.original` (legacy-shaped draft) and are **omitted** from the greenfield schema:

| Column | Reason omitted |
|--------|----------------|
| `Adjusted` | Replaced by per-adjustment `AdjustmentStatusId` on child rows |
| `TotalSection1TrueBasePremium` | Delta belongs on `PolicyCARAdjustment`, not on frozen policy |
| `TotalSection1ESL` | Same |
| `TotalSection1GST` | Same |
| `TotalSection1SD` | Same |
| `TotalSection1TotalPremium` | Same |
| `TotalSection2TrueBasePremium` | Same |
| `TotalSection2ESL` | Same |
| `TotalSection2GST` | Same |
| `TotalSection2SD` | Same |
| `TotalSection2TotalPremium` | Same |
| `TotalTotalPremium` | Same |
| `TotalSection1TerrorismPremium` | Adjustment delta field; lives on adjustment table |

### `PolicyCAR` — added columns

| Column | Purpose |
|--------|---------|
| `TakenAt` | Timestamp when status became Taken; marks immutable snapshot |
| `TakenBy` | Broker/user who committed the policy |

### New table: `AdjustmentStatus`

| AdjustmentStatusId | Name |
|--------------------|------|
| 1 | Draft |
| 2 | Applied |

Draft adjustments are editable and excluded from effective premium. Applied adjustments are immutable and participate in effective premium calculation.

### `PolicyCARAdjustment` — target shape (one-to-many)

**Key columns**

| Column | Purpose |
|--------|---------|
| `PolicyCARAdjustmentId` | Primary key; enables multiple rows per policy |
| `AdjustmentSequence` | Order within policy (1, 2, 3 …); unique with `PolicyId` |
| `AdjustmentReference` | Optional display label (e.g. `A-1`, `A-2`) |
| `AdjustmentStatusId` | FK → `AdjustmentStatus` (Draft / Applied) |
| `DeltaSection1TrueBasePremium` … `DeltaTotalPremium` | Premium **delta** vs original Taken snapshot |
| `CreatedWhen`, `CreatedBy` | Audit when adjustment draft was started |
| `AppliedWhen`, `AppliedBy` | Set when status transitions to Applied; null while Draft |

**Omitted vs `db.txt.original`**

| Column | Reason |
|--------|--------|
| `AdjustedDate` | Replaced by `CreatedWhen` + `AppliedWhen` |
| `AdjustedSection1BeforeBasePremium` | Not used in end-of-term adjustment calc |
| `AdjustedSection1PlantEquipment` | Plant excluded from adjustment model |
| `AdjustedSection1PlantESL` | Same |
| `AdjustedSection2BeforeBasePremium` | Not used in adjustment calc |

**Retained**

- `AdjustedTurnover`, `StampDutyExempt`
- `AdjustedSection*` / `AdjustedTotalPremium` — full recalculated premium at adjusted turnover
- `AdjustedCombinedFee`

**Constraints (implement in fresh schema)**

- `UNIQUE (PolicyId, AdjustmentSequence)`
- At most one **Draft** adjustment per policy (recommended business rule)
- Effective premium: `PolicyCAR.OriginalTotalPremium + latest Applied.DeltaTotalPremium`
- Immutability: application service (or DB trigger) blocks UPDATE on `PolicyCAR` when `CARStatusId = Taken`

---

### References added

```
Ref: PolicyCARAdjustment.AdjustmentStatusId > AdjustmentStatus.AdjustmentStatusId
```

---

### Greenfield implementation

1. Generate initial database from current `db.txt` only — no backfill from legacy.
2. Seed reference data (`CARStatus`, `AdjustmentStatus`, `PolicyType`, etc.) as defined in `db.txt` Records sections.
3. New policies start on the target model from day one; `TakenAt` / `TakenBy` set on first Taken commit.

---

### Related documentation

- [CAR_INSURANCE_APP_SPEC.md §6.6, §6.9](./CAR_INSURANCE_APP_SPEC.md) — functional requirements
- [CAR_SAVE_VALIDATION.md §5](./CAR_SAVE_VALIDATION.md) — lifecycle and validation matrix
- [CAR_PRICING_FORMULAS.md §7](./CAR_PRICING_FORMULAS.md) — adjustment premium formulas
