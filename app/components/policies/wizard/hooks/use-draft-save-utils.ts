import { toast } from "sonner";
import { labelForPolicyFieldPath } from "~/lib/policies/field-labels";
import { pricingFields } from "~/lib/zod/policy-car";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import type { PremiumBreakdown } from "~/lib/db/types";
import type { UseFormReturn } from "react-hook-form";

/**
 * Show toast notification for draft save
 */
export function toastPolicyDraftSaved(
  policyNumber: string | undefined,
  paths: string[],
) {
  const policy = policyNumber?.trim() || "Policy";
  const labels = [
    ...new Set(paths.map((path) => labelForPolicyFieldPath(path))),
  ];
  if (labels.length === 0) {
    toast.success(`${policy} saved`);
    return;
  }
  if (labels.length <= 3) {
    toast.success(`${policy} saved · ${labels.join(", ")}`);
    return;
  }
  toast.success(
    `${policy} saved · ${labels.slice(0, 3).join(", ")} +${labels.length - 3} more`,
  );
}

/**
 * Check if dirty paths are pricing-related fields
 */
export function hasTouchedPricing(paths: string[]): boolean {
  const pricingRoots = new Set<string>(pricingFields);
  return paths.some((path) => pricingRoots.has(path.split(".")[0] ?? path));
}

/**
 * Save operation configuration
 */
export interface SaveOptions {
  force?: boolean;
  skipPremiumRefresh?: boolean;
}

/**
 * Draft snapshot creation
 */
export function createDraftSnapshot(
  values: CarPolicyFormValues,
  premium: PremiumBreakdown | undefined,
  premiumManualKeys: string[],
): string {
  return JSON.stringify({
    ...values,
    ...(premium ? { premium } : {}),
    premiumManualKeys,
  });
}

/**
 * Save epoch for tracking concurrent saves
 */
export class SaveEpochTracker {
  private epoch = 0;

  increment(): number {
    return ++this.epoch;
  }

  isCurrent(epoch: number): boolean {
    return epoch === this.epoch;
  }

  get current(): number {
    return this.epoch;
  }
}

/**
 * Validation utilities
 */
export function validateSavedPaths(
  form: UseFormReturn<CarPolicyFormValues>,
  paths: string[],
): void {
  const unique = [...new Set(paths.filter((path) => path.length > 0))];
  if (unique.length === 0) return;
  void form.trigger(unique as (keyof CarPolicyFormValues)[]);
}
