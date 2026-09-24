import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { Policy } from "~/lib/db/types";
import { isRenewalPolicyCategory } from "~/lib/policies/policy-series";
import {
  type CarPolicyFormValues,
  isTerminalStatus,
} from "~/lib/zod/policy-car";

import { derivePolicyPhase, isEditablePhase } from "../shared/policy-phase";
import {
  PolicyPhaseContext,
  type PolicyPhaseContextValue,
} from "./policy-phase-context";

export function PolicyPhaseProvider({
  policy,
  initialIsNew,
  freshSteps,
  children,
}: {
  policy: Policy;
  initialIsNew: boolean;
  freshSteps: boolean;
  children: ReactNode;
}) {
  const { control } = useFormContext<CarPolicyFormValues>();
  const formStatusId = Number(useWatch({ control, name: "policyStatusId" }));
  const formCategoryId = Number(
    useWatch({ control, name: "policyCategoryId" }),
  );
  const [isNew, setIsNew] = useState(initialIsNew);
  const dismissNewPolicy = useCallback(() => setIsNew(false), []);

  const value = useMemo<PolicyPhaseContextValue>(() => {
    const phase = derivePolicyPhase(policy, isNew, formStatusId);
    const canEdit = isEditablePhase(phase);
    const isSavedTerminal = isTerminalStatus(policy.policyStatusId);
    const isFormTerminal = isTerminalStatus(formStatusId);
    const policyCategoryId = formCategoryId || policy.policyCategoryId;
    const isRenewal = isRenewalPolicyCategory(policyCategoryId);

    return {
      phase,
      canEdit,
      canShowSubmitButton: canEdit,
      canChangeStatus: phase === "pending",
      policyNumberEditable: !isSavedTerminal && !isRenewal,
      premiumPinned: phase !== "new",
      isNew,
      dismissNewPolicy,
      freshSteps,
      isSavedTerminal,
      isFormTerminal,
    };
  }, [
    policy,
    isNew,
    dismissNewPolicy,
    freshSteps,
    formStatusId,
    formCategoryId,
  ]);

  return (
    <PolicyPhaseContext.Provider value={value}>
      {children}
    </PolicyPhaseContext.Provider>
  );
}

/** @deprecated Use PolicyPhaseProvider */
export const ModeProvider = PolicyPhaseProvider;
