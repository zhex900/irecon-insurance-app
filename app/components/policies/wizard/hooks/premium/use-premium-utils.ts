import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { rollupPremiumTotals } from "~/lib/pricing/premium-totals";
import { pricingFields } from "~/lib/zod/policy-car";

/**
 * Add rolled-up totals to premium breakdown
 */
export function withRolledTotals(
  next: PremiumBreakdown | undefined,
): PremiumBreakdown | undefined {
  return next ? rollupPremiumTotals(next) : undefined;
}

/**
 * Check if any dirty paths are pricing-related fields
 */
export function hasTouchedPricing(dirtyPaths: string[]): boolean {
  const pricingRoots = new Set<string>(pricingFields);
  return dirtyPaths.some((path) =>
    pricingRoots.has(path.split(".")[0] ?? path),
  );
}

/**
 * Policy identity snapshot for change detection.
 * Loader revalidation allocates a new premium object — that is how Reset
 * Premium (and persisted manual keys) reach the UI after recalculate.
 */
export type PolicySnapshot = {
  policyId: string;
  premium: Policy["car"]["premium"];
};

/**
 * Create a policy snapshot for change detection
 */
export function createPolicySnapshot(policy: Policy): PolicySnapshot {
  return {
    policyId: policy.policyId,
    premium: policy.car.premium,
  };
}

/**
 * True when opening a different policy or the loader returned a new premium
 * snapshot (recalculate / refresh).
 */
export function hasPolicyChanged(
  currentSnapshot: PolicySnapshot,
  previousSnapshot: PolicySnapshot | null,
): boolean {
  if (!previousSnapshot) return true;
  return (
    currentSnapshot.policyId !== previousSnapshot.policyId ||
    currentSnapshot.premium !== previousSnapshot.premium
  );
}

/**
 * Apply a recalculate response only when it is the latest request and the
 * broker has not click-edited Premium Breakdown in the meantime.
 * Responses with no requestId (legacy / non-calc actions) still apply.
 */
export function shouldApplyPremiumResponse({
  hasPremium,
  isManualEdit,
  responseRequestId,
  latestRequestId,
}: {
  hasPremium: boolean;
  isManualEdit: boolean;
  responseRequestId: number | undefined;
  latestRequestId: number;
}): boolean {
  if (!hasPremium || isManualEdit) return false;
  if (responseRequestId == null) return true;
  return responseRequestId === latestRequestId;
}
