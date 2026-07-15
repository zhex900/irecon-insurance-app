import type { CarQuoteFormValues } from "~/lib/zod/policy-car";
import type { PolicyNote } from "~/lib/db/types";
import { calculateCarPremium } from "~/server/pricing/car-calculator";
import { getReferenceData } from "~/lib/services/store";

export function calculatePremiumForQuote(input: CarQuoteFormValues) {
  const reference = getReferenceData();
  const state = reference.states.find((item) => item.stateId === input.stateId);
  const stateCode = state?.code ?? "NSW";
  const brokerFeeTotal = reference.feeNames.reduce(
    (sum, fee) => sum + fee.fee + fee.feeGst,
    0,
  );

  return calculateCarPremium(input, stateCode, brokerFeeTotal);
}

export function buildReferralNotes(
  policyId: number,
  reasons: string[],
  createdBy: string,
): PolicyNote[] {
  if (reasons.length === 0) return [];
  return [
    {
      policyNoteId: Date.now(),
      policyId,
      policyNoteTypeId: 2,
      description: reasons.join("\n"),
      createdWhen: new Date().toISOString(),
      createdBy,
    },
  ];
}
