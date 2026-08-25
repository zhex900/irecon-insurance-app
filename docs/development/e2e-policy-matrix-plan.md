# E2E Policy Matrix — Critical Path Test Plan

Companion to [testing.md](testing.md) and [e2e-test-plan.md](e2e-test-plan.md).

This plan covers **policy creation → premium calculation → document generation → final status**, exercised for every **cover type × terminal status** combination using **deterministic static JSON fixtures** (input + expected output).

## 1. Goals

| Goal                                          | Why                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| Every cover type works end-to-end             | Annual, Single, and Owner Builder use different fields, templates, and document packs |
| Premium totals are correct in the UI          | Submit requires client-side premium; wrong totals block production flows              |
| Documents generate with correct merge content | Schedules, ratings, and library attachments must match policy data                    |
| Every final status is reachable               | Pending (post-submit), Taken, and Not taken are distinct product states               |

**Scope split** (do not duplicate layers):

| Layer              | Owns                                                                                      | Tool                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit / integration | Formula math, merge-field mapping, document pack logic                                    | Vitest (`tests/unit/premium-workings-golden-fixtures.test.ts`, `tests/unit/document-merge.test.ts`, `tests/integration/premium-calculation.test.ts`) |
| E2E (this plan)    | Full browser journey, UI totals match fixture, documents appear, status transitions stick | Playwright                                                                                                                                           |

E2E asserts **fixture parity** (UI + API payloads match committed JSON). Vitest owns **why** the numbers are right.

## 2. Cover type × status matrix (9 scenarios)

Cover types ([`app/lib/reference-data.ts`](../../app/lib/reference-data.ts)):

| `coverTypeId` | Name          | Wizard notes                                                                                   |
| ------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| 1             | Annual        | Requires **Annual Type of Cover**; turnover field; 18‑month period; geographical scope default |
| 2             | Single        | Project value / contract works; insured contracts read-only (mirrors site); 12‑month period    |
| 3             | Owner Builder | Same shape as Single with lower project caps; different default sub-limits                     |

Final statuses after submit / transition:

| Status    | `policyStatusId` | `data-policy-phase` | How to reach                                       |
| --------- | ---------------- | ------------------- | -------------------------------------------------- |
| Pending   | 1                | `pending`           | Submit policy (Confirm & generate) — **stop here** |
| Taken     | 2                | `taken`             | Pending → Policy status → Taken → Confirm          |
| Not taken | 3                | _(badge only)_      | Pending → Policy status → Not taken → Confirm      |

### Matrix (all combinations required)

| Scenario ID               | Cover type    | Final status | Priority |
| ------------------------- | ------------- | ------------ | -------- |
| `annual-pending`          | Annual        | Pending      | **P0**   |
| `annual-taken`            | Annual        | Taken        | P1       |
| `annual-not-taken`        | Annual        | Not taken    | P1       |
| `single-pending`          | Single        | Pending      | **P0**   |
| `single-taken`            | Single        | Taken        | P1       |
| `single-not-taken`        | Single        | Not taken    | P1       |
| `owner-builder-pending`   | Owner Builder | Pending      | P1       |
| `owner-builder-taken`     | Owner Builder | Taken        | P2       |
| `owner-builder-not-taken` | Owner Builder | Not taken    | P2       |

**P0** runs on every PR. **P1** runs in full E2E CI. **P2** can follow once P0/P1 are stable.

Each row = one Playwright test driven from scenario modules under `tests/e2e/scenarios/policy-matrix/`.

## 3. Critical path (every scenario)

Execute in order. Steps marked **assert** must compare against the scenario's `expected` values.

```
1. Login (broker storageState — no per-test login)
2. Open client → New policy                    → expect data-policy-phase = "new"
3. Select cover type from scenario.input         → cover-specific fields visible
4. Fill form from scenario.input            → all required fields + declarations
5. Open Premium Summary                         → trigger recalculate (auto or explicit)
6. **assert** premium UI totals match scenario.expected.premiumBreakdown
7. Submit → Confirm & generate                  → expect phase = "pending" (unless testing draft-only — not in matrix)
8. **assert** document list matches scenario.expected.documents
9. If terminalState = "taken"     → mark Taken     → expect phase = "taken"
   If terminalState = "not-taken"  → mark Not taken → expect badges
10. **assert** final phase / premium matches scenario.expected
```

**Resend** stays mocked (`mockResendEmailApi`). Do not send real email in matrix tests.

## 4. Scenario modules

### Layout

```
tests/e2e/scenarios/policy-matrix/
  types.ts                      # shared types
  annual-shared.ts              # shared input factory + premium/doc expectations
  annual-not-taken.ts
  annual-taken.ts
  index.ts                      # policyMatrixScenarios registry
```

Example: `annual-not-taken.ts` exports a `PolicyMatrixScenario` with `input`, `expected`, and `terminalState`.

### Input shape (`<scenario>.ts` → `*Input`)

```json
{
  "scenarioId": "single-pending",
  "coverTypeId": 2,
  "coverTypeName": "Single",
  "annualCoverTypeId": null,
  "annualCoverTypeName": null,
  "finalStatus": "pending",
  "client": {
    "pick": "first-seeded"
  },
  "form": {
    "insuredName": "E2E Matrix Single Pending Pty Ltd",
    "siteAddress": "100 Matrix Street, Sydney NSW 2000",
    "postcode": "2000",
    "state": "NSW",
    "estimatedTurnover": 1000000,
    "contractWorksSumInsured": 1500000,
    "displayHomes": 0,
    "existingStructure": 0,
    "plantEquipment": 50000,
    "liabilityLimitBand": "$10 Million",
    "hasExistingContractWorksCover": "No",
    "claimsCountLast3Years": 0,
    "anyClaimsExceed20k": "No",
    "declarationConfirmed": true,
    "unsealedRoadworksConfirmed": true
  },
  "dates": {
    "mode": "relative",
    "startDayOfMonth": 1,
    "durationMonths": 12
  }
}
```

**Annual-only** fields: `annualCoverTypeId` / `annualCoverTypeName` (`Contract Commencing` or `Transfer`), `durationMonths: 18`.

**Single / Owner Builder**: omit annual type; use `contractWorksSumInsured` as primary project value.

Use **fixed strings and numbers** — no `faker`, no `Date.now()`, so expected JSON stays stable.

### Expected shape (`<scenario>.ts` → `*Expected`)

```json
{
  "scenarioId": "single-pending",
  "status": {
    "policyStatusId": 1,
    "phase": "pending",
    "badgeText": "Pending"
  },
  "premium": {
    "contractWorksTotalPremium": 0,
    "liabilityTotalPremium": 0,
    "originalTotalPremium": 0,
    "combinedBrokerFee": 0
  },
  "premiumDisplay": {
    "originalTotalPremium": "$0.00"
  },
  "premiumTolerance": 0.01,
  "documents": {
    "packTemplateKeys": [],
    "minDocumentCount": 1,
    "mergeFields": {
      "CoverType": "Single",
      "InsuredName": "E2E Matrix Single Pending Pty Ltd",
      "SiteAddress": "100 Matrix Street, Sydney NSW 2000"
    }
  }
}
```

Numeric `premium` values must be captured against the **CI seed price catalogue** (see §6). `premiumDisplay` strings match formatted UI labels.

### Capturing expected values (one-time / when rates change)

1. Run locally with CI DB: `npm run ci:db && npm run dev`
2. Execute the scenario once with a debug helper that logs recalculate response + merge inputs
3. Copy values into `*.expected.json`
4. Commit — future test runs diff live output against fixture

When broker fees or price tables change, update fixtures deliberately (same as golden PDF workflow in [pdf-output-comparison-test-design.md](testing/pdf-output-comparison-test-design.md)).

## 5. Document generation assertions

Do **not** byte-compare PDFs in Playwright (slow, flaky). Layer assertions:

| Level    | What to assert                                                                                                    | Where                  |
| -------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **E2E**  | Document rows appear in Premium Summary; correct labels; preview/download actions enabled after submit            | Playwright             |
| **E2E**  | Intercept `POST …/policies/:id` or document generate response; parse returned `documents[]` for `templateKey` set | Playwright + fixture   |
| **E2E**  | Selected merge fields on snapshot (if exposed in generate API payload or `.data` loader)                          | Fixture `mergeFields`  |
| **Unit** | Full merge-field map, endorsement HTML, PDF bytes                                                                 | Vitest golden fixtures |

Expected `packTemplateKeys` per cover type (verify against published templates in seed):

| Cover type    | Typical template keys                               |
| ------------- | --------------------------------------------------- |
| Annual        | `schedule-annual`, `rating-annual`, …               |
| Single        | `schedule-single`, `rating-single`, …               |
| Owner Builder | `schedule-owner-builder`, `rating-owner-builder`, … |

Exact list is environment-dependent — capture into each scenario’s `expected.json`, not hard-coded in spec logic.

**Content checks in E2E:** assert merge fields that users care about (`CoverType`, `InsuredName`, `SiteAddress`, `LegalLiabilityLimit`, total premium label). Deep HTML endorsement layout stays in unit tests.

## 6. Premium calculation assertions

Before submit, the app requires premium on the client ([`use-submit.ts`](../../app/components/policies/wizard/hooks/composite/use-submit.ts)).

E2E helper flow:

1. Navigate to **Premium Summary** section (expand wizard section if collapsed)
2. Wait for recalculate idle (no loading spinner; totals visible)
3. Read displayed total(s) from Premium Summary
4. Optionally intercept last recalculate response body for structured `premium` object

Compare using `premiumTolerance` (default `$0.01`) for floats.

Formula edge cases (zero turnover, min premium, terrorism tiers) remain in Vitest — **not** duplicated across 9 E2E rows unless a dedicated pricing scenario is added later.

## 7. Implementation plan

### Phase 0 — Foundation (current)

- [x] `policy-wizard.ts` helpers: fill, submit, phase assertions
- [x] `policy-flow-quote-to-taken.spec.ts` — single path (Single-ish defaults → Pending → Not taken)
- [x] Scenario modules under `tests/e2e/scenarios/policy-matrix/`
- [x] `policy-matrix-flow.ts` + `policy-matrix-assertions.ts`

### Phase 1 — P0 (2 tests)

Parametrized spec: `tests/e2e/policy-matrix.spec.ts`

```ts
for (const scenario of policyMatrixScenarios) {
  test(`${scenario.name}: create → premium → documents → status`, …);
}
```

### Phase 2 — P1 (7 tests)

Add remaining matrix rows. Tag: `@policy-matrix`.

### Phase 3 — Hardening

- Deterministic E2E client in DB seed (fixed client id) so “pick first client” is stable
- Parallel: dedicated `policy-matrix` Playwright project with `workers: 2` and `fullyParallel: true`
- CI artifact: dump mismatch diff when scenario assert fails

## 8. Playwright conventions

- Project: `policy-matrix` (2 workers, 120s timeout) — run alone via `npm run test:e2e:policy-matrix`
- Tag slow tests: `{ tag: ["@policy-matrix", "@p0"] }` for selective runs:

```bash
E2E_SKIP_WEBSERVER=1 E2E_BASE_URL=http://localhost:5173 \
  npx playwright test tests/e2e/policy-matrix.spec.ts --grep @p0
```

## 9. Definition of done

- [ ] All 9 scenario IDs in `manifest.ts` have paired input + expected exports in their module (or `index.ts` registry)
- [ ] P0 scenarios pass in CI against seeded DB
- [ ] Each test: static input → static expected; no random data
- [ ] Premium and document assertions fail with readable diff (field path + expected vs actual)
- [ ] [e2e-test-plan.md](e2e-test-plan.md) §5 workflow 1 links here for policy depth

## 10. Out of scope (explicit)

- Adjustment save flow (not yet covered in E2E)
- Email send content (mock only)
- PDF byte identity (unit golden fixtures)
- Every validation error message
- Renewal (`policyCategoryId: 2`) — add as second matrix later if needed
