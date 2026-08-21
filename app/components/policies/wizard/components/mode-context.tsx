import { createContext, type ReactNode, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { Policy } from "~/lib/db/types";
import {
  type CarPolicyFormValues,
  isTerminalStatus,
} from "~/lib/zod/policy-car";

import {
  derivePolicyPhase,
  isEditablePhase,
  type PolicyPhase,
} from "../shared/policy-phase";

export type PolicyPhaseContextValue = {
  phase: PolicyPhase;
  canEdit: boolean;
  canShowSubmitButton: boolean;
  canChangeStatus: boolean;
  policyNumberEditable: boolean;
  premiumPinned: boolean;
  isNew: boolean;
  freshSteps: boolean;
  /** Saved policy status is terminal (Taken / Not taken). */
  isSavedTerminal: boolean;
  /** Live form status is terminal (includes confirm-before-save). */
  isFormTerminal: boolean;
};

const defaultValue: PolicyPhaseContextValue = {
  phase: "pending",
  canEdit: true,
  canShowSubmitButton: true,
  canChangeStatus: false,
  policyNumberEditable: true,
  premiumPinned: false,
  isNew: false,
  freshSteps: false,
  isSavedTerminal: false,
  isFormTerminal: false,
};

const PolicyPhaseContext = createContext<PolicyPhaseContextValue>(defaultValue);

export function PolicyPhaseProvider({
  policy,
  isNew,
  freshSteps,
  children,
}: {
  policy: Policy;
  isNew: boolean;
  freshSteps: boolean;
  children: ReactNode;
}) {
  const { control } = useFormContext<CarPolicyFormValues>();
  const formStatusId = Number(useWatch({ control, name: "policyStatusId" }));

  const value = useMemo<PolicyPhaseContextValue>(() => {
    const phase = derivePolicyPhase(policy, isNew, formStatusId);
    const canEdit = isEditablePhase(phase);
    const isSavedTerminal = isTerminalStatus(policy.policyStatusId);
    const isFormTerminal = isTerminalStatus(formStatusId);

    return {
      phase,
      canEdit,
      canShowSubmitButton: canEdit,
      canChangeStatus: phase === "pending",
      policyNumberEditable: !isSavedTerminal,
      premiumPinned: phase !== "new",
      isNew,
      freshSteps,
      isSavedTerminal,
      isFormTerminal,
    };
  }, [policy, isNew, freshSteps, formStatusId]);

  return (
    <PolicyPhaseContext.Provider value={value}>
      {children}
    </PolicyPhaseContext.Provider>
  );
}

/** @deprecated Use PolicyPhaseProvider */
export const ModeProvider = PolicyPhaseProvider;

export { PolicyPhaseContext };
