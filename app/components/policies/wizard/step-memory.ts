import { wizardSteps } from "~/lib/zod/policy-car";

export const PRICING_CONFIRMATION_STEP = wizardSteps.length - 1;

/** Survives remounts within the same JS realm (HMR may clear this). */
export const wizardStepMemory = new Map<
  number,
  { step: number; maxStep: number }
>();

export function clampStep(step: number): number | null {
  if (!Number.isInteger(step) || step < 0) return null;
  // Clamp past end so stored "Review"/"Pricing" indices still land on last step.
  if (step >= wizardSteps.length) return PRICING_CONFIRMATION_STEP;
  return step;
}

export function parseStep(raw: string | null): number | null {
  if (raw == null) return null;
  return clampStep(Number(raw));
}

export function readStoredStep(policyId: number): number | null {
  const memorized = wizardStepMemory.get(policyId)?.step;
  if (memorized != null) {
    const clamped = clampStep(memorized);
    if (clamped != null) return clamped;
  }
  if (typeof window === "undefined") return null;
  return parseStep(sessionStorage.getItem(`car-policy-step:${policyId}`));
}

export function readStoredMaxStep(policyId: number, fallback: number): number {
  const memorized = wizardStepMemory.get(policyId)?.maxStep;
  if (memorized != null) {
    const clamped = clampStep(memorized);
    if (clamped != null) return Math.max(clamped, fallback);
  }
  if (typeof window !== "undefined") {
    const stored = parseStep(
      sessionStorage.getItem(`car-policy-max-step:${policyId}`),
    );
    if (stored != null) return Math.max(stored, fallback);
  }
  return fallback;
}

/** Only call from explicit navigation — never from mount defaults. */
export function rememberWizardStep(
  policyId: number,
  step: number,
  maxStep: number,
) {
  wizardStepMemory.set(policyId, { step, maxStep });
  if (typeof window !== "undefined") {
    sessionStorage.setItem(`car-policy-step:${policyId}`, String(step));
    sessionStorage.setItem(`car-policy-max-step:${policyId}`, String(maxStep));
  }
}

/** Reset wizard progress for a policy (e.g. after clone). */
export function clearWizardStepState(policyId: number) {
  wizardStepMemory.delete(policyId);
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(`car-policy-step:${policyId}`);
    sessionStorage.removeItem(`car-policy-max-step:${policyId}`);
    sessionStorage.removeItem(`car-policy-focus-section:${policyId}`);
  }
}

/** After submit redirect, land on this section once. */
export function rememberFocusSection(policyId: number, sectionId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`car-policy-focus-section:${policyId}`, sectionId);
}

export function peekFocusSection(policyId: number): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`car-policy-focus-section:${policyId}`);
}

export function clearFocusSection(policyId: number) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(`car-policy-focus-section:${policyId}`);
}

/** One-shot leave allowlist for destructive actions (e.g. delete). */
export const allowLeavePolicyIds = new Set<number>();

export function allowWizardLeave(policyId: number) {
  allowLeavePolicyIds.add(policyId);
}

export function consumeWizardLeave(policyId: number) {
  if (!allowLeavePolicyIds.has(policyId)) return false;
  allowLeavePolicyIds.delete(policyId);
  return true;
}
