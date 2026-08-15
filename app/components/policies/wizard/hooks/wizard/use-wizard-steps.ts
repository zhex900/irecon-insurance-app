import { useLayoutEffect, useRef, useState } from "react";
import { useMode } from "../utils/use-mode";
import type { PremiumBreakdown } from "~/lib/db/types";
import {
  readStoredMaxStep,
  readStoredStep,
  rememberWizardStep,
  PRICING_CONFIRMATION_STEP,
} from "../../wizard-step-memory";
import { calculateMaxStep } from "./use-wizard-navigation-utils";
import { sectionIdForStep } from "~/components/policies/policy-form-layout";
import { wizardSteps } from "~/lib/zod/policy-car";

export function useWizardStepManagement({
  policyId,
  policyPremium,
}: {
  policyId: string;
  policyPremium: PremiumBreakdown | null | undefined;
}) {
  const { readOnly, fieldsLocked, freshSteps } = useMode();

  const [step, setStep] = useState(() =>
    freshSteps ? 0 : (readStoredStep(policyId) ?? 0),
  );
  const [maxStep, setMaxStep] = useState(() =>
    calculateMaxStep(
      policyId,
      readOnly,
      freshSteps,
      policyPremium,
      readStoredStep,
      readStoredMaxStep,
    ),
  );

  // SSR renders step 0; restore remembered step before paint (read-only — do not write).
  // When policyId changes, re-derive from that policy — never carry over step/maxStep
  // from the previous policy.
  const lastNavRef = useRef<{
    policyId: string;
    readOnly: boolean;
    policyPremium: PremiumBreakdown | null | undefined;
  } | null>(null);

  useLayoutEffect(() => {
    if (freshSteps) return; // Fresh steps mode — keep step at 0
    const prev = lastNavRef.current;
    const changed =
      !prev ||
      prev.policyId !== policyId ||
      prev.readOnly !== readOnly ||
      prev.policyPremium !== policyPremium;
    if (!changed) return;
    lastNavRef.current = { policyId, readOnly, policyPremium };
    const current = lastNavRef.current;
    if (current.readOnly) {
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
  }, [policyId, policyPremium, readOnly, freshSteps]);

  // Validation for step navigation
  function canNavigateToStep(index: number, unlock: boolean): boolean {
    if (index < 0 || index >= wizardSteps.length) return false;
    if (!fieldsLocked && !unlock && index > maxStep) return false;
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
