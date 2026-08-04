# Legacy vs rebuild: manual Premium Breakdown

How live Premium Breakdown edits differ between the legacy CAR portal (`CalculatePremium` in `CARNewPolicy.aspx` / `CARViewPolicy.aspx`) and this rebuild (`app/lib/premium-manual-recalc.ts`).

Canonical formulas for the rebuild: [car-premium-formulas.md](./car-premium-formulas.md) §6.

Assume lookup terrorism rate **τ = 0.053** unless noted.

---

## Summary

| #   | Behaviour                             | Legacy                                                | Rebuild                                                                                          |
| --- | ------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | True Base recalculates Terrorism Levy | `base × τ` only — **drops** ES/DH terror add-ons      | `(base + ES + DH) × τ` — **keeps** fold                                                          |
| 2   | Broker types a Terrorism Levy amount  | Display becomes `entered + ES×τ′ + DH×τ′`             | Display **stays** `entered`                                                                      |
| 3   | Save / bind terrorism rate            | `TerrorismRate = levy ÷ True Base` (can inflate τ)    | Lookup / session τ **not** overwritten that way on draft save                                    |
| 4   | Edit ESL / Stamp Duty / GST           | Sets `DoNotCalculate` — ESL/SD freeze for the session | Typed tax line sticks for that edit only; **later** driver edits refresh ESL/SD/GST from formula |

---

## Quirk 1 — True Base drops ES/DH terrorism (legacy)

**Problem:** ES/DH premium lines still exist and are charged, but their terrorism is silently removed from the levy until the broker edits ES or DH again.

| Step                      | True Base |  ES |  DH |                  Legacy levy |                          Rebuild levy |
| ------------------------- | --------: | --: | --: | ---------------------------: | ------------------------------------: |
| After ES/DH edit          |     1,250 | 340 |  10 |                    **84.80** |                             **84.80** |
| Change True Base → 11,250 |    11,250 | 340 |  10 | **596.25** (`11250 × 0.053`) | **614.80** (`(11250+340+10) × 0.053`) |

Legacy undercharges **$18.55** of terrorism while ES/DH remain on the breakdown.

**Rebuild:** True Base uses the same fold as an ES/DH edit: `(base + ES + DH) × τ`.

---

## Quirk 2 — Typing Terrorism Levy inflates the field (legacy)

**Problem:** The number the broker types is not what stays on screen when ES/DH &gt; 0.

Example: True Base `1,250`, ES `340`, DH `10`, Plant `100`. Broker types **`100.00`**:

|                        | Legacy                            | Rebuild                  |
| ---------------------- | --------------------------------- | ------------------------ |
| Session `τ′`           | `100 / 1250 = 0.08`               | same                     |
| Plant terrorism        | `8.00`                            | `8.00`                   |
| Plant ESL              | unchanged                         | unchanged                |
| Terrorism Levy display | **128.00** (`100 + 27.20 + 0.80`) | **100.00** (typed value) |

**Rebuild:** typed levy sticks; plant terror still uses `τ′ = entered / True Base`.

---

## Quirk 3 — Save inflates stored `TerrorismRate` (legacy)

**Problem:** On save, legacy runs:

```text
TerrorismRate = Section1TerrorismPremium / Section1TrueBasePremium
```

If the levy already includes ES/DH fold, the stored rate is too high.

|                       |                                           Amount |
| --------------------- | -----------------------------------------------: |
| True Base             |                                            1,250 |
| Folded levy           |                                            84.80 |
| Saved `TerrorismRate` | `84.80 / 1250 = 0.06784` (should remain `0.053`) |

Later True Base → `11,250` with corrupted rate and Quirk 1 (no ES/DH re-add):

```text
Legacy levy ≈ 11250 × 0.06784 = 763.20
```

vs rebuild with lookup τ and fold: `(11250 + 340 + 10) × 0.053 = 614.80`.

**Rebuild:** draft save keeps `rating.terrorismRate` from the calculator / extras snapshot. Session `τ` only changes in-memory when the broker edits Terrorism Levy (Quirk 2 path). Reset Premium clears session rates and recalculates from lookup rates.

---

## Quirk 4 — ESL / SD / GST edit freezes auto tax (legacy)

**Problem:** Editing ESL, Stamp Duty, or GST sets `DoNotCalculate` for the session. Further True Base / ES / DH / terror edits do **not** refresh ESL or Stamp Duty. GST is still force-recalculated (so a manual GST often does not stick). Easy to leave stale ESL/SD after changing premium drivers.

Example (legacy): set ESL to `99.00`, then change True Base → ESL stays `99.00` while base/terror/GST move.

**Rebuild:**

- Editing a tax line updates that line (and immediate dependents for the current snapshot).
- Does **not** set a permanent freeze.
- The next True Base / ES / DH / terror / plant driver edit recalculates ESL, GST, and Stamp Duty from formula again.

---

## Source map

| Concern                | Legacy                                                                           | Rebuild                                                        |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Live manual recalc     | `CalculatePremium` in `CARNewPolicy.aspx` / `CARViewPolicy.aspx`                 | `applyManualPremiumEdit` in `app/lib/premium-manual-recalc.ts` |
| Session terror rate    | `hidSection1TerrorRate`                                                          | `sessionRates.terrorismRate` in Premium Breakdown UI           |
| Session plant ESL rate | `hidSection1ESLPlantEquipmentRate`                                               | `sessionRates.plantEslRate`                                    |
| Tax freeze             | `hidDoNotCalculate` / `DoNotCalculate`                                           | Removed                                                        |
| Save rate back-calc    | `CARNewPolicy.aspx.cs` / `CARViewPolicy.aspx.cs` (`TerrorismRate = levy / base`) | Not applied on draft save                                      |
