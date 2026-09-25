import { useLayoutEffect, useRef, useState } from "react";

import { sectionIdForStep } from "~/components/policies/policy-form-layout";
import type { PremiumBreakdown } from "~/lib/db/types";
import { wizardSteps } from "~/lib/zod/policy-car";

import {
  PRICING_CONFIRMATION_STEP,
  readStoredMaxStep,
  readStoredStep,
  rememberWizardStep,
} from "../../wizard-step-memory";
import { usePolicyPhase } from "../utils/use-policy-phase";
import { calculateMaxStep } from "./use-wizard-navigation-utils";

export function useWizardStepManagement({
  policyId,
  policyPremium,
}: {
  policyId: string;
  policyPremium: PremiumBreakdown | null | undefined;
}) {
  const { isSavedTerminal, canEdit, freshSteps } = usePolicyPhase();

  const [step, setStep] = useState(() =>
    freshSteps ? 0 : (readStoredStep(policyId) ?? 0),
  );
  const [maxStep, setMaxStep] = useState(() =>
    calculateMaxStep(
      policyId,
      isSavedTerminal,
      freshSteps,
      policyPremium,
      readStoredStep,
      readStoredMaxStep,
    ),
  );

  const lastNavRef = useRef<{
    policyId: string;
    isSavedTerminal: boolean;
    policyPremium: PremiumBreakdown | null | undefined;
  } | null>(null);

  useLayoutEffect(() => {
    if (freshSteps) return;
    const prev = lastNavRef.current;
    const changed =
      !prev ||
      prev.policyId !== policyId ||
      prev.isSavedTerminal !== isSavedTerminal ||
      prev.policyPremium !== policyPremium;
    if (!changed) return;
    lastNavRef.current = { policyId, isSavedTerminal, policyPremium };
    const current = lastNavRef.current;
    if (current.isSavedTerminal) {
      setStep(readStoredStep(current.policyId) ?? 0);
      setMaxStep(wizardSteps.length - 1);
      return;
    }
    const storedStep = readStoredStep(current.policyId) ?? 0;
    setStep(storedStep);
    const unlockedByPremium = current.policyPremium
      ? PRICING_CONFIRMATION_STEP
      : storedStep;
    setMaxStep(
      readStoredMaxStep(
        current.policyId,
        Math.max(storedStep, unlockedByPremium),
      ),
    );
  }, [policyId, policyPremium, isSavedTerminal, freshSteps]);

  function canNavigateToStep(index: number, unlock: boolean): boolean {
    if (index < 0 || index >= wizardSteps.length) return false;
    if (canEdit && !unlock && index > maxStep) return false;
    return true;
  }

  function goToStep(index: number, { unlock = false } = {}) {
    if (!canNavigateToStep(index, unlock)) return;
    const nextMax = Math.max(maxStep, index);
    rememberWizardStep(policyId, index, nextMax);
    setStep(index);
    setMaxStep(nextMax);
    return {
      sectionId: sectionIdForStep(index),
      nextMax,
    };
  }

  return {
    step,
    maxStep,
    setStep,
    setMaxStep,
    goToStep,
    canNavigateToStep,
  };
}
