/**
 * CAR referral reason list (informational — does not block save).
 * Shared by the calculator and Premium Summary so override amounts stay in sync.
 */
import type { PremiumBreakdown } from "~/lib/db/types";
import { preferPremiumOverride } from "~/lib/premium-override";
import { formatCurrency } from "~/lib/utils";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

const TERROR_START_DATE = "2021-01-01";

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

/** Build referral reasons; prefer Premium overrides for DH / ES amounts. */
export function buildReferralReasons(
  input: Pick<
    CarPolicyFormValues,
    | "displayHomes"
    | "existingStructure"
    | "claimsCountLast3Years"
    | "anyClaimsExceed20k"
    | "hasExistingContractWorksCover"
    | "plantEquipment"
    | "liabilityLimitBand"
    | "dateStart"
  >,
  rating: ReferralRatingInput,
  liabilityLabel: string,
  premium?: PremiumBreakdown | null,
): string[] {
  const reasons: string[] = [];

  const displayHomesValue = preferPremiumOverride(
    premium?.contractWorksDisplayHomesPremium,
    input.displayHomes,
  );
  const existingStructureValue = preferPremiumOverride(
    premium?.contractWorksExistingStructurePremium,
    input.existingStructure,
  );

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
  if (input.anyClaimsExceed20k) {
    reasons.push("Any claims exceeded $20,000 in value is stated as yes");
  }
  if (!input.hasExistingContractWorksCover) {
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
