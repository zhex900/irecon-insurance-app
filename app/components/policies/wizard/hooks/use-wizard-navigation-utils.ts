import { wizardStepFields, wizardSteps } from "~/lib/zod/policy-car";
import type { PremiumBreakdown } from "~/lib/db/types";
import { PRICING_CONFIRMATION_STEP } from "../step-memory";
import { sectionIdForStep } from "~/components/policies/policy-form-layout";

/**
 * Find which wizard step a field path belongs to
 */
export function findStepForFieldPath(path: string): number | null {
  for (const [stepKey, fields] of Object.entries(wizardStepFields)) {
    if (
      fields.some((field) => path === field || path.startsWith(`${field}.`))
    ) {
      return Number(stepKey);
    }
  }
  return null;
}

/**
 * Helper function for calculating max step
 */
export function calculateMaxStep(
  policyId: string, 
  readOnly: boolean, 
  freshSteps: boolean,
  policyPremium: PremiumBreakdown | null | undefined,
  readStoredStep: (policyId: string) => number | null,
  readStoredMaxStep: (policyId: string, proposed: number) => number
): number {
  if (freshSteps) return 0;
  if (readOnly) return wizardSteps.length - 1;
  
  const remembered = readStoredStep(policyId) ?? 0;
  const unlockedByPremium = policyPremium
    ? PRICING_CONFIRMATION_STEP
    : remembered;
  
  return readStoredMaxStep(policyId, Math.max(remembered, unlockedByPremium));
}

export { sectionIdForStep };