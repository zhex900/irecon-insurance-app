import type { Policy,PremiumBreakdown } from "~/lib/db/types";
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
 * Policy identity snapshot for change detection
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
 * Check if policy has changed based on snapshot
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
