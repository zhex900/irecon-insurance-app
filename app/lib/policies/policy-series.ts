import { resolveSeriesNumberForSave } from "~/lib/policies/policy-number";

/** Policy category "Renewal" (RWL) — see reference-data. */
export const POLICY_CATEGORY_RENEWAL_ID = 2;

export const RENEWAL_SERIES_IMMUTABLE_MESSAGE =
  "Renewal policy number cannot be changed";

export function isRenewalPolicyCategory(categoryId: number): boolean {
  return categoryId === POLICY_CATEGORY_RENEWAL_ID;
}

/** Effective category after a draft/submit merge. */
export function effectivePolicyCategoryId(
  submitted: number | undefined,
  existing: number,
): number {
  return submitted ?? existing;
}

/**
 * Client-facing series number from form `policyNumber`.
 * Renewals always keep the existing series (matches UI read-only).
 */
export function resolveSeriesNumberFromForm(
  existingSeriesNumber: string,
  submittedPolicyNumber: string | undefined,
  options: {
    policyCategoryId: number;
    terminalLocked: boolean;
  },
): string {
  if (isRenewalPolicyCategory(options.policyCategoryId)) {
    return existingSeriesNumber;
  }
  return resolveSeriesNumberForSave(
    existingSeriesNumber,
    submittedPolicyNumber,
    options.terminalLocked,
  );
}
