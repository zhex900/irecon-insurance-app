import type { CarAdjustmentRecord, PolicyNote, Policy } from "~/lib/db/types";
import type { CarAdjustmentInput } from "~/lib/zod/policy-adjustment";
import { POLICY_STATUS } from "~/lib/zod/policy-car";
import { collectEndorsementWordings } from "~/lib/pdf/merge-fields";
import {
  calculateCarAdjustment,
  validateAdjustmentFinish,
} from "~/server/pricing/car-adjustment-calculator";
import {
  buildAdjustmentDocumentPack,
  mergeReviewDocuments,
  syncPolicyDocumentLabels,
} from "~/lib/services/policy/documents";
import { listPublishedForAdjustment } from "~/lib/services/documents/document-templates";
import { getPolicy, savePolicy } from "~/lib/services/policy/data.service";
import { getCarWording } from "~/lib/services/reference.service";
import { resolveBrokerFeeLines } from "~/server/pricing/rate-resolver";

export class AdjustmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdjustmentError";
  }
}

export function calculateAdjustmentForPolicy(
  policy: Policy,
  input: CarAdjustmentInput,
) {
  if (policy.policyStatusId !== POLICY_STATUS.Taken) {
    throw new AdjustmentError(
      "You can only adjust a policy where the status is taken.",
    );
  }
  if (!policy.car.premium || !policy.car.rating) {
    throw new AdjustmentError(
      "Premium must be calculated before adjusting this policy.",
    );
  }
  // Stage 1: save overwrites the single adjustment row (legacy parity).

  const stampDutyExempt = input.stampDutyExempt === "yes";
  return calculateCarAdjustment({
    originalTurnover: policy.car.estimatedTurnover,
    adjustmentTurnover: input.adjustmentTurnover,
    stampDutyExempt,
    premium: policy.car.premium,
    rating: policy.car.rating,
  });
}

export async function submitPolicyAdjustment(
  policyId: number,
  input: CarAdjustmentInput,
  createdBy: string,
) {
  const existing = await getPolicy(policyId);
  if (!existing) throw new AdjustmentError("Policy not found");

  const breakdown = calculateAdjustmentForPolicy(existing, input);
  const validationError = validateAdjustmentFinish(breakdown);
  if (validationError) {
    throw new AdjustmentError(validationError);
  }

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
    adjustedContractWorksTotalPremium:
      breakdown.adjustment.section1.totalPremium,
    adjustedLiabilityBasePremium: breakdown.adjustment.section2.trueBasePremium,
    adjustedSection2Esl: breakdown.adjustment.section2.esl,
    adjustedSection2Gst: breakdown.adjustment.section2.gst,
    adjustedSection2Sd: breakdown.adjustment.section2.sd,
    adjustedLiabilityTotalPremium: breakdown.adjustment.section2.totalPremium,
    totalContractWorksBasePremium: breakdown.delta.section1.trueBasePremium,
    totalContractWorksTerrorismPremium:
      breakdown.delta.section1.terrorismPremium,
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
    description: `Adjusted by ${createdBy}`,
    createdWhen: new Date().toISOString(),
    createdBy,
  };

  const wordingCatalogue = await getCarWording();
  const policy: Policy = {
    ...existing,
    notes: [...(existing.notes ?? []), note],
    car: {
      ...existing.car,
      adjusted: true,
      adjustment,
      endorsementWordings: collectEndorsementWordings(
        existing.car,
        wordingCatalogue,
      ),
    },
  };

  // Adjustment saved → adjustment document only (append-only).
  const [templates, brokerFeeLines] = await Promise.all([
    listPublishedForAdjustment(),
    resolveBrokerFeeLines(policy.dateStart),
  ]);
  const templateMeta = templates.map((t) => ({
    key: t.key,
    title: t.title,
    label: t.label,
  }));
  const pack = buildAdjustmentDocumentPack(
    policy,
    createdBy,
    templateMeta,
    policy.documents ?? [],
    { brokerFeeLines },
  );
  const merged = mergeReviewDocuments(policy.documents, pack);
  const documents = syncPolicyDocumentLabels(merged, {
    templates: templateMeta,
  });

  return savePolicy({ ...policy, documents });
}
