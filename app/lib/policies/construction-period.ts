/**
 * Single source of truth for the Maximum Construction Period default,
 * shared by the wizard (cover type change) and renewals (copied cover).
 */
export function deriveMaximumConstructionPeriod(
  coverTypeId: number,
  annualCoverTypeId?: number | null,
): number {
  if (coverTypeId === 1) {
    // Annual: Contract Commencing (2) is 12 months; Transfer (1)/unset is 18.
    return annualCoverTypeId === 2 ? 12 : 18;
  }
  // Single / Owner Builder
  return 12;
}
