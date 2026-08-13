import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { WizardMode } from "./car-policy-wizard-shared";

/**
 * Single source of truth for the wizard's mode-driven UI, replacing the raw
 * `readOnly` / `isNew` / `fieldsLocked` prop-threading documented in
 * docs/plans/car-wizard-boolean-props-refactor.md. Modeled on the
 * `JustSavedProvider` pattern (~/components/forms/field-save-highlight.tsx):
 * a fully-implemented default value (no null-checks), computed once by the
 * provider, consumed via a narrow hook.
 */
export type PolicyWizardModeValue = {
  /** Raw prop, passed straight through — terminal (Taken/NotTaken) view. */
  readOnly: boolean;
  /** Raw prop, passed straight through — fresh unsaved draft. */
  isNew: boolean;
  /** Fresh steps mode — reset navigation step to 0 (e.g., cloned policies). */
  freshSteps: boolean;
  /** Live form-selected status is terminal. Drives `fieldsLocked` with `readOnly`. */
  isFormTerminal: boolean;
  /** `readOnly || isFormTerminal` (live form status, not just the saved one). */
  fieldsLocked: boolean;
  /** `isNew ? "new" : fieldsLocked ? "view" : "edit"` — de-facto style/badge source. */
  wizardMode: WizardMode;
  /** Dedupes `!readOnly && !isFormTerminal`, previously recomputed in both
   * the header and the footer. */
  canShowSubmitButton: boolean;
  /** Policy number is editable until Taken/Not taken is *saved* — independent
   * of the live (unsaved) form status used by `fieldsLocked`. */
  policyNumberEditable: boolean;
  /** Pin Premium under Policy Information after the first submit. */
  premiumPinned: boolean;
};

const defaultValue: PolicyWizardModeValue = {
  readOnly: false,
  isNew: false,
  freshSteps: false,
  isFormTerminal: false,
  fieldsLocked: false,
  wizardMode: "edit",
  canShowSubmitButton: true,
  policyNumberEditable: true,
  premiumPinned: false,
};

const PolicyWizardModeContext =
  createContext<PolicyWizardModeValue>(defaultValue);

// Helper functions for clear derived state
function computeFieldsLocked(readOnly: boolean, isFormTerminal: boolean): boolean {
  return readOnly || isFormTerminal;
}

function computeCanShowSubmitButton(readOnly: boolean, isFormTerminal: boolean): boolean {
  return !readOnly && !isFormTerminal;
}

function computeWizardMode(isNew: boolean, fieldsLocked: boolean): WizardMode {
  return isNew ? "new" : fieldsLocked ? "view" : "edit";
}

function computePolicyNumberEditable(readOnly: boolean, policyAlreadyTerminal: boolean): boolean {
  return !readOnly && !policyAlreadyTerminal;
}

export function PolicyWizardModeProvider({
  readOnly,
  isNew,
  freshSteps,
  isFormTerminal,
  policyAlreadyTerminal,
  hasSubmittedOnce,
  children,
}: {
  readOnly: boolean;
  isNew: boolean;
  freshSteps: boolean;
  /** Live form-selected status is terminal (drives `fieldsLocked`). */
  isFormTerminal: boolean;
  /** Saved/persisted status is terminal (drives `policyNumberEditable`). */
  policyAlreadyTerminal: boolean;
  hasSubmittedOnce: boolean;
  children: ReactNode;
}) {
  const value = useMemo<PolicyWizardModeValue>(() => {
    const fieldsLocked = computeFieldsLocked(readOnly, isFormTerminal);
    const wizardMode = computeWizardMode(isNew, fieldsLocked);
    const canShowSubmitButton = computeCanShowSubmitButton(readOnly, isFormTerminal);
    const policyNumberEditable = computePolicyNumberEditable(readOnly, policyAlreadyTerminal);

    return {
      readOnly,
      isNew,
      freshSteps,
      isFormTerminal,
      fieldsLocked,
      wizardMode,
      canShowSubmitButton,
      policyNumberEditable,
      premiumPinned: hasSubmittedOnce,
    };
  }, [
    readOnly,
    isNew,
    freshSteps,
    isFormTerminal,
    policyAlreadyTerminal,
    hasSubmittedOnce,
  ]);

  return (
    <PolicyWizardModeContext.Provider value={value}>
      {children}
    </PolicyWizardModeContext.Provider>
  );
}

export function usePolicyWizardMode() {
  return useContext(PolicyWizardModeContext);
}
