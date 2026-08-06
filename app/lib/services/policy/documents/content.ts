import type { Policy, PolicyDocument } from "~/lib/db/types";
import { formatCurrency, formatRate } from "~/lib/utils";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatDocTimestamp(date: Date) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())} ${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}${String(date.getMilliseconds()).padStart(3, "0")}`;
}

export function nextDocumentId(existing: PolicyDocument[]) {
  return Math.max(0, ...existing.map((doc) => doc.policyDocumentId)) + 1;
}

/** Next amendment index for a template key (0, 1, 2…) so filenames stay unique. */
export function nextAmendmentNumber(
  existing: PolicyDocument[],
  templateKey: string,
) {
  return existing.filter((doc) => doc.templateKey === templateKey).length;
}

function coverTypeLabel(coverTypeId: number | string | null | undefined) {
  const id = Number(coverTypeId);
  if (id === 2) return "Single";
  if (id === 3) return "Owner Builder";
  if (id === 1) return "Annual";
  return "";
}

function effectiveTotalPremium(policy: Policy): number | null {
  const premium = policy.car.premium;
  if (!premium) return null;
  const delta = policy.car.adjustment?.adjustedTotalPremium ?? 0;
  return premium.originalTotalPremium + delta;
}

export function buildScheduleContent(policy: Policy): string {
  const premium = policy.car.premium;
  const adjustment = policy.car.adjustment;
  const lines = [
    "CAR Schedule",
    `Policy number: ${policy.policyNumber}`,
    `Insured: ${policy.car.insuredName}`,
    `Cover type: ${coverTypeLabel(policy.car.coverTypeId)}`,
    `Site address: ${policy.car.siteAddress || "—"}`,
    `Period: ${policy.dateStart} to ${policy.dateEnd}`,
    `Estimated turnover: ${formatCurrency(policy.car.estimatedTurnover)}`,
    `Contract works sum insured: ${formatCurrency(policy.car.contractWorksSumInsured)}`,
    `Plant & equipment: ${formatCurrency(policy.car.plantEquipment)}`,
    `Existing structure: ${formatCurrency(policy.car.existingStructure)}`,
    `Display homes: ${formatCurrency(policy.car.displayHomes)}`,
  ];

  if (adjustment && premium) {
    const effective = effectiveTotalPremium(policy);
    lines.push(
      `Adjusted turnover: ${formatCurrency(adjustment.adjustedTurnover)}`,
      `Original total premium: ${formatCurrency(premium.originalTotalPremium)}`,
      `Adjustment delta: ${formatCurrency(adjustment.adjustedTotalPremium)}`,
      `Effective total premium: ${formatCurrency(effective ?? 0)}`,
      `Absolute premium at adjusted turnover: ${formatCurrency(adjustment.breakdown.adjustment.total.totalPremium)}`,
    );
  } else if (premium) {
    lines.push(
      `Total premium: ${formatCurrency(premium.originalTotalPremium)}`,
    );
  } else {
    lines.push("Total premium: not calculated");
  }

  return lines.join("\n");
}

export function buildRatingContent(policy: Policy): string {
  const premium = policy.car.premium;
  const rating = policy.car.rating;
  const adjustment = policy.car.adjustment;
  const lines = [
    "CAR Rating / Record of Advice",
    `Policy number: ${policy.policyNumber}`,
    `Insured: ${policy.car.insuredName}`,
  ];

  if (adjustment && premium) {
    const effective = effectiveTotalPremium(policy);
    lines.push(
      `Original contract works total: ${formatCurrency(premium.contractWorksTotalPremium)}`,
      `Original legal liability total: ${formatCurrency(premium.liabilityTotalPremium)}`,
      `Original total premium: ${formatCurrency(premium.originalTotalPremium)}`,
      `Adjusted turnover: ${formatCurrency(adjustment.adjustedTurnover)}`,
      `Absolute CW premium (adjusted): ${formatCurrency(adjustment.breakdown.adjustment.section1.totalPremium)}`,
      `Absolute liability premium (adjusted): ${formatCurrency(adjustment.breakdown.adjustment.section2.totalPremium)}`,
      `Adjustment delta: ${formatCurrency(adjustment.adjustedTotalPremium)}`,
      `Effective total premium: ${formatCurrency(effective ?? 0)}`,
    );
  } else if (premium) {
    lines.push(
      `Contract works total: ${formatCurrency(premium.contractWorksTotalPremium)}`,
      `Legal liability total: ${formatCurrency(premium.liabilityTotalPremium)}`,
      `Broker fees: ${formatCurrency(premium.combinedBrokerFee)}`,
      `Total premium: ${formatCurrency(premium.originalTotalPremium)}`,
    );
  } else {
    lines.push("Premium not calculated");
  }

  if (rating) {
    lines.push(
      `CW applied rate: ${rating.contractWorksAppliedRate}`,
      `Liability applied rate: ${rating.liabilityAppliedRate}`,
      `Terrorism rate: ${formatRate(rating.terrorismRate)}`,
    );
  } else {
    lines.push("Rating snapshot unavailable");
  }

  if (policy.car.referralReasons?.length) {
    lines.push(
      "Referral reasons:",
      ...policy.car.referralReasons.map((r) => `- ${r}`),
    );
  } else {
    lines.push("No referral reasons");
  }

  return lines.join("\n");
}

export function buildAdjustmentContent(policy: Policy): string {
  const adjustment = policy.car.adjustment;
  const premium = policy.car.premium;
  if (!adjustment || !premium) {
    return "Adjustment details unavailable.";
  }
  const effective = effectiveTotalPremium(policy);
  return [
    "CAR Adjustment",
    `Policy number: ${policy.policyNumber}`,
    `Insured: ${policy.car.insuredName}`,
    `Original turnover: ${formatCurrency(adjustment.breakdown.originalTurnover)}`,
    `Adjusted turnover: ${formatCurrency(adjustment.adjustedTurnover)}`,
    `Stamp duty exempt: ${adjustment.stampDutyExempt ? "Yes" : "No"}`,
    `Adjusted date: ${adjustment.adjustedDate}`,
    `Original total premium: ${formatCurrency(premium.originalTotalPremium)}`,
    `Absolute premium at adjusted turnover: ${formatCurrency(adjustment.breakdown.adjustment.total.totalPremium)}`,
    `Adjustment delta (invoice): ${formatCurrency(adjustment.adjustedTotalPremium)}`,
    `Effective total premium: ${formatCurrency(effective ?? 0)}`,
  ].join("\n");
}

export function makeDoc(input: {
  id: number;
  policyId: string;
  name: string;
  filename: string;
  generationKey: string;
  content: string;
  generatedBy: string;
  generatedWhen: string;
  templateKey?: string;
  libraryDocumentId?: number;
  mergeInputs?: Record<string, string>;
}): PolicyDocument {
  return {
    policyDocumentId: input.id,
    policyId: input.policyId,
    name: input.name,
    filename: input.filename,
    generationKey: input.generationKey,
    content: input.content,
    templateKey: input.templateKey,
    libraryDocumentId: input.libraryDocumentId,
    mergeInputs: input.mergeInputs,
    generatedWhen: input.generatedWhen,
    generatedBy: input.generatedBy,
  };
}
