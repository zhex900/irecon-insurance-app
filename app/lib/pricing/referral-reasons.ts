/**
 * CAR referral reason list (informational — does not block save).
 * Shared by the calculator and Premium Summary.
 *
 * Display Homes / Existing Structure reasons use Limits of Liability
 * sum-insured fields — not Premium Breakdown lines.
 */
import { TERROR_START_DATE } from "~/constants";
import { formatCurrency } from "~/lib/utils";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

/** Rating fields needed for rate-missing referral reasons. */
export type ReferralRatingInput = {
  contractWorksAppliedRate: number;
  liabilityAppliedRate: number;
  stampDutyId: number;
  eslId: number;
  isTerrorismRateExist: boolean;
};

export function liabilityLimitLabel(band: number): string {
  switch (band) {
    case 1:
      return "$10 Million";
    case 2:
      return "$20 Million";
    default:
      return "Not Insured";
  }
}

/** Form selects often yield `"true"` / `"false"` strings — avoid `Boolean("false")`. */
export function coerceFormBoolean(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

/** Build referral reasons from risk / limits inputs + rating presence. */
export function buildReferralReasons(
  input: {
    displayHomes?: CarPolicyFormValues["displayHomes"];
    existingStructure?: CarPolicyFormValues["existingStructure"];
    claimsCountLast3Years?: CarPolicyFormValues["claimsCountLast3Years"];
    anyClaimsExceed20k?: unknown;
    hasExistingContractWorksCover?: unknown;
    plantEquipment?: CarPolicyFormValues["plantEquipment"];
    liabilityLimitBand?: CarPolicyFormValues["liabilityLimitBand"];
    dateStart?: CarPolicyFormValues["dateStart"];
  },
  rating: ReferralRatingInput,
  liabilityLabel: string,
): string[] {
  const reasons: string[] = [];

  const displayHomesValue = Number(input.displayHomes) || 0;
  const existingStructureValue = Number(input.existingStructure) || 0;

  if (displayHomesValue > 0) {
    reasons.push(
      `Display Homes has a value of ${formatCurrency(displayHomesValue)}`,
    );
  }
  if (existingStructureValue > 0) {
    reasons.push(
      `Existing Structure has a value of ${formatCurrency(existingStructureValue)}`,
    );
  }
  if (Number(input.claimsCountLast3Years) >= 3) {
    reasons.push(
      `Number of claim last 3 years is entered with value ${input.claimsCountLast3Years}`,
    );
  }
  const claimsExceed20k = coerceFormBoolean(input.anyClaimsExceed20k);
  if (claimsExceed20k === true) {
    reasons.push("Any claims exceeded $20,000 in value is stated as yes");
  } else if (claimsExceed20k === false) {
    reasons.push("Any claims exceeded $20,000 in value is stated as no");
  }
  if (coerceFormBoolean(input.hasExistingContractWorksCover) === false) {
    reasons.push("Do not hold a current Contract Works/Liability policy");
  }
  if (Number(input.plantEquipment) > 50000) {
    reasons.push(
      "Named Insureds Construction Plant & Equipment is over 50,000",
    );
  }
  if (rating.contractWorksAppliedRate === 0) {
    reasons.push("Unable to find Contract Works rate");
  }
  if (
    Number(input.liabilityLimitBand) !== 3 &&
    rating.liabilityAppliedRate === 0
  ) {
    reasons.push(`Unable to find Liability rate for ${liabilityLabel}`);
  }
  if (rating.stampDutyId === 0) {
    reasons.push("Unable to find the SD rate");
  }
  if (rating.eslId === 0) {
    reasons.push("Unable to find the ESL rate");
  }
  if (
    !rating.isTerrorismRateExist &&
    String(input.dateStart ?? "") >= TERROR_START_DATE
  ) {
    reasons.push(
      "Unable to find terrorism rate for this combination of postcode/State",
    );
  }

  return reasons;
}
