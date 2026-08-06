import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import { calculateCarPremium } from "~/server/pricing/car-calculator";
import { resolveBrokerFeeTotal } from "~/server/pricing/rate-resolver";
import { getReferenceData } from "~/lib/services/reference.service";

export async function calculatePremiumForPolicy(input: CarPolicyFormValues) {
  const reference = getReferenceData();
  const state = reference.states.find((item) => item.stateId === input.stateId);
  const stateCode = state?.code ?? "NSW";
  const brokerFeeTotal = await resolveBrokerFeeTotal(input.dateStart);

  return calculateCarPremium(input, stateCode, brokerFeeTotal);
}

/** Re-exports for server callers that historically imported notes from here. */
export {
  buildReferralNotes,
  mergeReferralNotes,
  createMessageNote,
  createInformationalNote,
  sortPolicyNotesDescending,
} from "~/lib/policies/policy-notes";
