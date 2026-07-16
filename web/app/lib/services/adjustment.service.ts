import type { CarAdjustmentRecord, PolicyNote, Quote } from "~/lib/db/types";
import type { CarAdjustmentInput } from "~/lib/zod/policy-adjustment";
import { POLICY_STATUS } from "~/lib/zod/policy-car";
import {
  calculateCarAdjustment,
  validateAdjustmentFinish,
} from "~/server/pricing/car-adjustment-calculator";
import { getBrokerSession, getQuote, saveQuote } from "~/lib/services/store";

export class AdjustmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdjustmentError";
  }
}

export function calculateAdjustmentForQuote(
  quote: Quote,
  input: CarAdjustmentInput,
) {
  if (quote.policyStatusId !== POLICY_STATUS.Taken) {
    throw new AdjustmentError(
      "You can only adjust a policy where the status is taken.",
    );
  }
  if (!quote.car.premium || !quote.car.rating) {
    throw new AdjustmentError(
      "Premium must be calculated before adjusting this policy.",
    );
  }
  if (quote.car.adjusted) {
    throw new AdjustmentError("This policy has already been adjusted.");
  }

  const stampDutyExempt = input.stampDutyExempt === "yes";
  return calculateCarAdjustment({
    originalTurnover: quote.car.estimatedTurnover,
    adjustmentTurnover: input.adjustmentTurnover,
    stampDutyExempt,
    premium: quote.car.premium,
    rating: quote.car.rating,
  });
}

export async function submitPolicyAdjustment(
  policyId: number,
  input: CarAdjustmentInput,
) {
  const existing = await getQuote(policyId);
  if (!existing) throw new AdjustmentError("Quote not found");

  const breakdown = calculateAdjustmentForQuote(existing, input);
  const validationError = validateAdjustmentFinish(breakdown);
  if (validationError) {
    throw new AdjustmentError(validationError);
  }

  const broker = getBrokerSession();
  const adjustment: CarAdjustmentRecord = {
    adjustedTurnover: input.adjustmentTurnover,
    stampDutyExempt: input.stampDutyExempt === "yes",
    adjustedDate: new Date().toISOString(),
    breakdown,
    adjustedContractWorksBasePremium:
      breakdown.adjustment.section1.trueBasePremium,
    adjustedContractWorksTerrorismPremium:
      breakdown.adjustment.section1.terrorismPremium,
    adjustedSection1Esl: breakdown.adjustment.section1.esl,
    adjustedSection1Gst: breakdown.adjustment.section1.gst,
    adjustedSection1Sd: breakdown.adjustment.section1.sd,
    adjustedContractWorksTotalPremium: breakdown.adjustment.section1.totalPremium,
    adjustedLiabilityBasePremium:
      breakdown.adjustment.section2.trueBasePremium,
    adjustedSection2Esl: breakdown.adjustment.section2.esl,
    adjustedSection2Gst: breakdown.adjustment.section2.gst,
    adjustedSection2Sd: breakdown.adjustment.section2.sd,
    adjustedLiabilityTotalPremium: breakdown.adjustment.section2.totalPremium,
    totalContractWorksBasePremium: breakdown.delta.section1.trueBasePremium,
    totalContractWorksTerrorismPremium: breakdown.delta.section1.terrorismPremium,
    totalSection1Esl: breakdown.delta.section1.esl,
    totalSection1Gst: breakdown.delta.section1.gst,
    totalSection1Sd: breakdown.delta.section1.sd,
    totalContractWorksTotalPremium: breakdown.delta.section1.totalPremium,
    totalLiabilityBasePremium: breakdown.delta.section2.trueBasePremium,
    totalSection2Esl: breakdown.delta.section2.esl,
    totalSection2Gst: breakdown.delta.section2.gst,
    totalSection2Sd: breakdown.delta.section2.sd,
    totalLiabilityTotalPremium: breakdown.delta.section2.totalPremium,
    adjustedTotalPremium: breakdown.delta.total.totalPremium,
  };

  const note: PolicyNote = {
    policyNoteId: Date.now(),
    policyId,
    policyNoteTypeId: 2,
    description: `Adjusted by ${broker.email}`,
    createdWhen: new Date().toISOString(),
    createdBy: broker.email,
  };

  const quote: Quote = {
    ...existing,
    notes: [...(existing.notes ?? []), note],
    car: {
      ...existing.car,
      adjusted: true,
      adjustment,
    },
  };

  return saveQuote(quote);
}
