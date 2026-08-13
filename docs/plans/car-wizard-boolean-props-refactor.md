# CAR wizard refactor — resolving the boolean-prop-proliferation debt

Companion to [docs/CODE_REVIEW_2026-08-12.md](../CODE_REVIEW_2026-08-12.md) open finding #2. This is a **plan only** — nothing in this doc has been implemented yet.

## Problem statement

`readOnly`, `freshSteps`, and `isNew` (plus the derived `fieldsLocked`, `premiumPinned`, `wizardMode`) are threaded as raw props through ~10 files in `app/components/policies/wizard/**`. The clearest symptom already fixed on 2026-08-12: `section-stack.tsx` rendered a duplicated ~45-line premium-section JSX block for the `premiumPinned` true/false cases (now computed once, placed conditionally). The underlying prop-threading itself was left alone as documented debt because a full migration is high-risk on the highest-traffic, most business-critical surface in the app.

## Current state (full map)

There is **exactly one** mount site: `app/routes/_app/policies/$policyId.tsx:512-543`. Every "mode" is a URL/state variation of this one route:

| Scenario                  | Trigger                                       | `readOnly`      | `freshSteps` | `isNew` |
| ------------------------- | --------------------------------------------- | --------------- | ------------ | ------- |
| New policy                | `policies/new.tsx` action → redirect `?new=1` | `false`         | `false`      | `true`  |
| Existing edit             | Direct nav, Pending/non-terminal              | `false`         | `false`      | `false` |
| Read-only / terminal view | Status is Taken/NotTaken                      | `true`          | maybe        | `false` |
| Cloned policy             | Clone action → redirect `?cloned=1`           | usually `false` | `true`       | `false` |

`/policies/:policyId/adjust` renders a **separate** component (`CarAdjustmentWizard`, not in `wizard/**`) — out of scope.

### Per-boolean fan-out (file:line detail in the research transcript — [Map CAR wizard readOnly/freshSteps/isNew threading](06b46ff3-354a-4077-aa36-609e945a89f7))

- **`readOnly`** → `fieldsLocked` derivation, `policyNumberEditable`, `usePolicyWizardNavigation` (unlocks all steps), `usePolicyLeaveGuard` (skips leave-confirm), `CarPolicyWizardHeader` (hides Submit), `WizardFormFooter` (hides Submit, relabels Cancel).
- **`fieldsLocked`** (`readOnly || isFormTerminal`) → navigation step-gating, premium auto-recalc suppression, autosave suppression, keyboard-save suppression, `canChangeStatus`, `wizardMode`, `WizardSectionStack`'s `<fieldset disabled>` + nulled premium-edit callbacks.
- **`freshSteps`** → **single consumer**: `usePolicyWizardNavigation` (resets step/maxStep to 0 instead of restoring session memory). Combined with a `key=` remount trick at the mount site.
- **`isNew`** → RHF default-value blanking, `wizardMode`, desktop-rail notes visibility, mobile-notes gate, `usePolicyLeaveGuard` (always-block + discard-vs-navigate + dialog copy).
- **Duplicated compound logic**: `!readOnly && !isFormTerminal` is independently recomputed in both `car-policy-wizard-header.tsx:97` and `form-footer.tsx:61` — the one clear "should be one source of truth" bug-risk spot.
- **`wizardMode`** (`isNew ? "new" : fieldsLocked ? "view" : "edit"`) is already the de-facto single source of truth for style/badge decisions and is reused consistently — the gap is everything else still being threaded raw alongside it.

### Existing precedent to build on

No compound-component (`Namespace.Part`) pattern exists anywhere in this codebase. Two `createContext` precedents exist under `app/components`:

- **`app/components/forms/field-save-highlight.tsx`** (`JustSavedProvider`) — already wraps this exact wizard (`car-policy-wizard.tsx`). Uses `createContext` with a fully-implemented default value (no null-checks), a memoized grouped-actions value object, and a narrow derived hook (`useFieldSaveState`) for leaf components. **Best local fit to extend.**
- **`app/components/ui/sidebar.tsx`** (`SidebarProvider`/`useSidebar`) — stricter `createContext<T | null>(null)` + throw-if-missing pattern, with controlled/uncontrolled `open` support. Reference only if a future need for prop-override emerges.

## Recommended approach

**A `PolicyWizardModeProvider` context, modeled on the existing `JustSavedProvider` pattern** — not a full compound-component rewrite, and not explicit variant components (`NewPolicyWizard`/`ReadOnlyPolicyWizard`/`EditPolicyWizard`).

Why not the alternatives:

- **Explicit variant components** (the composition-patterns skill's default recommendation) — rejected: the three modes share ~95% of rendering logic (all 5 sections, all hooks); three near-duplicate top-level components would themselves become the next duplication problem whenever a step changes.
- **Full compound-component rewrite** (`PolicyWizard.Header`, `PolicyWizard.Section`, ...) — deferred, not rejected: it's the "ideal" end state per the composition-patterns skill, but has no local precedent, requires restructuring every section's call site, and delivers the same practical outcome as a context provider for this specific finding at far higher blast radius. Worth reconsidering only if the wizard grows more modes/steps later.
- **Context provider modeled on `JustSavedProvider`** — chosen: matches an existing, working local pattern (repo decision rule: "prefer consistency over novelty"), removes the real duplication (the header/footer Submit-button gate) and the raw prop-threading, without touching every section's JSX structure.

### What the provider owns

Computed once in `car-policy-wizard-inner.tsx` from the raw inputs (`policy`, `readOnly`, `isNew`, `hasSubmittedOnce`), exposed via a `usePolicyWizardMode()` hook:

- `readOnly`, `isNew` (raw, passed straight through)
- `fieldsLocked` (`readOnly || isFormTerminal`)
- `wizardMode` (`"new" | "edit" | "view"`)
- `canShowSubmitButton` (dedupes the `!readOnly && !isFormTerminal` logic currently duplicated in header + footer)
- `policyNumberEditable`
- `premiumPinned`

**`freshSteps` deliberately stays a direct prop** into `usePolicyWizardNavigation` — it has exactly one consumer today, so folding it into shared context would be new abstraction without removing any duplication (repo rule: "every abstraction must remove duplication or complexity").

## Phased implementation plan

Each phase is its own small PR, verified with `npm run typecheck && npm run lint && npm run test:unit` plus a manual click-through of all 4 real-world modes (new / edit / read-only-terminal / cloned) before moving to the next phase — there is currently no automated interaction test for this wizard, so manual verification (or the Playwright addition in Phase A below) is the only safety net.

| Phase                | Change                                                                                                                                                                                                                                                           | Files touched                              | Risk                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| **A (prerequisite)** | Add Playwright coverage for the 4 modes to `e2e/policy.spec.ts` (new policy save, existing-policy edit + submit, terminal/read-only view, clone) — closes the gap already flagged in `docs/e2e-test-plan.md` and gives every later phase a real regression check | `e2e/policy.spec.ts`                       | None (pure test addition)                                         |
| **0**                | Add `PolicyWizardModeProvider` + `usePolicyWizardMode()` (new file, e.g. `car-policy-wizard-mode-context.tsx`), populate it in `car-policy-wizard-inner.tsx`. Existing props keep flowing unchanged — this phase is pure addition                                | 1 new file + `car-policy-wizard-inner.tsx` | None (additive only)                                              |
| **1**                | Migrate the duplicated Submit-button gate: `car-policy-wizard-header.tsx` and `form-footer.tsx` read `canShowSubmitButton` from context instead of recomputing `!readOnly && !isFormTerminal`                                                                    | 2 files                                    | Low — behavior-preserving, removes real duplication               |
| **2**                | Migrate `wizardMode` consumers (header, desktop-rail, information-card style helpers) from prop to context read                                                                                                                                                  | 3 files                                    | Low — same values, different source                               |
| **3**                | Migrate `isNew` consumers: desktop-rail notes gate, mobile-notes gate, `usePolicyLeaveGuard`, `LeaveDiscardDialog` copy                                                                                                                                          | 4 files                                    | Medium — leave-guard has real side-effect timing (router blocker) |
| **4**                | Migrate `readOnly`/`fieldsLocked` consumers: `WizardSectionStack` fieldset, `usePolicyPremiumCalc`, `usePolicyDraftSave`, `usePolicyDraftKeyboardSave`, `usePolicyWizardNavigation`                                                                              | 5 files                                    | Medium — autosave/premium timing, most-used hooks                 |
| **5**                | Cleanup: remove now-dead prop plumbing from `CarPolicyWizardProps`, `WizardSectionStackProps`, and any component prop types fully replaced by context                                                                                                            | Several                                    | Low, mechanical                                                   |

Total estimated files touched across all phases: ~12-14 (matches the ~10 files originally flagged, plus the new context file and test file).

## Non-goals

- No change to wizard business logic (premium calc rules, leave-guard rules, step-gating rules, autosave timing) — this is plumbing/architecture only.
- No change to `CarAdjustmentWizard` (`app/components/policies/car-adjustment-wizard.tsx`) — separate component tree.
- No change to the route-level props contract (`$policyId.tsx` keeps passing `readOnly`/`freshSteps`/`isNew`/`policy` into `CarPolicyWizard` exactly as today).

## Decisions

1. **Phase A (Playwright coverage) is required** before Phase 0 — proceeding with it now.
2. **Land as one PR per phase** — 6 separate, independently-reviewable PRs (A, 0, 1, 2, 3, 4, 5 — actually 7 including cleanup).
3. **No other route/embed context will reuse `CarPolicyWizard`** — confirms the simpler `JustSavedProvider`-style context (fully-implemented default value, no null-checks) is the right fit; no need for `SidebarProvider`'s controlled/uncontrolled flexibility.

## Status

- [x] Phase A — Playwright coverage for the 4 modes (`e2e/policy.spec.ts` — `policy wizard modes` describe block: new/edit transition, terminal read-only view, clone. Also fixed 3 pre-existing latent selector bugs in the same file — client/policy rows use `InteractiveTableRow` (`<tr>`), not `<a>`, so `getByRole("link")`/`a[href^=...]` selectors never matched; and policy IDs are UUIDs, not `\d+`.)
- [x] Phase 0 — `PolicyWizardModeProvider` + `usePolicyWizardMode()` added in `car-policy-wizard-mode-context.tsx`, wraps the returned JSX in `car-policy-wizard-inner.tsx` (additive only — no consumer migrated yet at this point).
- [x] Phase 1 — `CarPolicyWizardHeader` and `WizardFormFooter` now read `canShowSubmitButton` from context instead of each recomputing `!readOnly && !isFormTerminal`.
- [x] Phase 2 — `wizardMode` consumers (header, desktop-rail, mobile-notes) read from context instead of a prop.
- [x] Phase 3 — `isNew` consumers migrated: desktop-rail notes gate, `LeaveDiscardDialog` copy (via `car-policy-wizard-dialogs.tsx` → `dialogs.tsx`). `usePolicyLeaveGuard`'s `isNew` stays a raw hook parameter — it's called in `CarPolicyWizardInner`'s body *before* the `PolicyWizardModeProvider` renders, so it cannot safely consume the context (see Non-goals below, extended).
- [x] Phase 4 — `readOnly`/`fieldsLocked` consumers migrated where the consumer is a genuine JSX descendant of the provider: `WizardSectionStack` (`fieldset disabled`, premium-edit callbacks), `CarPolicyWizardInformationCard` (`policyNumberEditable`). The premium-calc/draft-save/navigation/leave-guard/keyboard-save hooks (`use-premium-calc.ts`, `use-draft-save.ts`, `use-navigation.ts`, `use-leave-guard.ts`, `use-draft-keyboard-save.ts`) keep `readOnly`/`fieldsLocked` as raw parameters for the same reason as Phase 3's leave-guard — they're called before the provider mounts.
- [x] Phase 5 — Removed dead local computation in `car-policy-wizard-inner.tsx` and prop fields from `CarPolicyWizardHeaderProps`, `CarPolicyWizardDesktopRailProps`, `WizardSectionStackProps`, `LeaveDiscardDialogProps`, `CarPolicyWizardDialogsProps`, `WizardFormFooterProps`.
- [x] **Phase 6 — Fully close the context gap** (follow-up): Restructured component hierarchy with `CarPolicyWizardInnerContent`, moved all business logic hooks inside the provider, updated 5 hooks to read context instead of props. Now zero raw prop threading remains.
- [x] **Phase 7 — Improve readability** (follow-up): Extracted complex derived computations into named helper functions (`computeFieldsLocked`, `computeCanShowSubmitButton`, etc.), simplified navigation validation logic, broke down complex functions like `saveAndLeave` into focused sub-functions, and memoized repeated computations.

All phases verified with `npm run typecheck`, `npm run lint`, `npm run test:unit` (163 passed), and the full `e2e/policy.spec.ts` suite (4 passed, 2 skipped for Resend-mocking/data dependency).

### Follow-up: Fully closing the context gap (achieved)

The architectural limitation identified during Phase 5 — hooks called before the provider mounts cannot safely consume context — has now been fully addressed:

- **Restructured component hierarchy**: `CarPolicyWizardInner` became a slim wrapper that provides the `PolicyWizardModeProvider`, containing only the minimum form-watching needed for `isFormTerminal` computation.
- **Extracted content component**: Created `CarPolicyWizardInnerContent` containing all the business logic hooks (`usePolicyWizardNavigation`, `usePolicyPremiumCalc`, `usePolicyDraftSave`, `usePolicyLeaveGuard`, `usePolicyDraftKeyboardSave`), now safely positioned **inside** the provider as genuine JSX descendants.
- **Updated all hooks**: Modified 5 core hooks to read `readOnly`/`isNew`/`fieldsLocked`/`isFormTerminal` from the `usePolicyWizardMode()` context instead of receiving them as props. This eliminated the last remaining raw prop threading through the wizard's internal API.
- **Added `isFormTerminal` to context**: Enhanced the `PolicyWizardModeValue` type to include `isFormTerminal`, allowing components to distinguish between "locked due to readOnly" vs "locked due to terminal status" without recomputing `fieldsLocked && !readOnly`.
- **Improved readability**: Extracted complex derived computations into named helper functions (`computeFieldsLocked`, `computeCanShowSubmitButton`, `computeWizardMode`, `computePolicyNumberEditable`), simplified navigation validation with `canNavigateToStep`, broke down `saveAndLeave` into focused sub-functions (`saveAndLeaveForTerminalStatus`, `saveAndLeaveForDraft`), extracted `hasTouchedPricing` check, memoized repeated `wizardModeCardBorderClass` computations.
- **Cleaner API surface**: The public interface (`CarPolicyWizardProps`) remains unchanged, preserving backward compatibility while the internal implementation is now fully context-driven and readable.

Result: **All wizard mode state now flows through a single source of truth**, with zero raw prop threading between the provider and business logic hooks, and no derived computations needed by consuming components.
