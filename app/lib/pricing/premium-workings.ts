import type { PremiumBreakdown, RatingSnapshot } from "~/lib/db/types";

import { calcBundle } from "./premium-calculations";
import { formatCurrency, formatRate, roundMoney, step } from "./premium-utils";

export type PremiumWorkingStep = {
  label: string;
  detail?: string;
};

export type PremiumLineWorking = {
  title: string;
  steps: PremiumWorkingStep[];
  calculated: number;
  current: number;
  manual: boolean;
};

export type PremiumWorkingInputs = {
  estimatedTurnover: number;
  plantEquipment: number;
  contractWorksSumInsured: number;
  dateStart: string;
  brokerFeeTotal: number;
};

/** Expected auto-calculated value for a premium field (legacy server formulas). */
export function expectedPremiumValue(
  key: keyof PremiumBreakdown,
  premium: PremiumBreakdown,
  rating: RatingSnapshot | undefined,
  inputs: PremiumWorkingInputs,
): number | null {
  if (!rating) return null;
  const c = calcBundle(rating, inputs);

  switch (key) {
    case "contractWorksCalculatedBasePremium":
      return c.cwCalc;
    case "contractWorksBasePremium":
      return c.cwBase;
    case "contractWorksTerrorismPremium":
      return c.terror;
    case "contractWorksDisplayHomesPremium":
    case "contractWorksExistingStructurePremium":
      return 0;
    case "contractWorksPlantPremium":
      return c.plant;
    case "contractWorksPlantTerrorismPremium":
      return c.plantTerror;
    case "contractWorksPlantESL":
      return c.plantEsl;
    case "contractWorksESL":
      return c.esl;
    case "contractWorksGST":
      return c.gst;
    case "contractWorksStampDuty":
      return c.stamp;
    case "contractWorksTotalPremium":
      return roundMoney(
        c.cwTotal +
          (premium.contractWorksDisplayHomesPremium ?? 0) +
          (premium.contractWorksExistingStructurePremium ?? 0),
      );
    case "liabilityCalculatedBasePremium":
      return c.liabCalc;
    case "liabilityBasePremium":
      return c.liabBase;
    case "liabilityESL":
      return c.liabEsl;
    case "liabilityGST":
      return c.liabGst;
    case "liabilityStampDuty":
      return c.liabStamp;
    case "liabilityTotalPremium":
      return c.liabTotal;
    case "combinedBrokerFee":
      return c.brokerFee;
    case "originalTotalPremium":
      return roundMoney(
        c.cwTotal +
          (premium.contractWorksDisplayHomesPremium ?? 0) +
          (premium.contractWorksExistingStructurePremium ?? 0) +
          c.liabTotal +
          c.brokerFee,
      );
    default:
      return null;
  }
}

/**
 * True when the broker explicitly click-edited this Premium Breakdown line.
 * Cascaded dependents (recalculated from a manual edit) are not marked manual.
 */
export function isPremiumLineManual(
  key: keyof PremiumBreakdown,
  explicitManualKeys: ReadonlySet<string>,
): boolean {
  return explicitManualKeys.has(key);
}

export function buildPremiumLineWorking(args: {
  title: string;
  key: keyof PremiumBreakdown;
  premium: PremiumBreakdown;
  rating: RatingSnapshot | undefined;
  inputs: PremiumWorkingInputs;
  explicitManualKeys: ReadonlySet<string>;
}): PremiumLineWorking {
  const { title, key, premium, rating, inputs, explicitManualKeys } = args;
  const current = premium[key] ?? 0;
  const calculated =
    expectedPremiumValue(key, premium, rating, inputs) ?? current;
  const manual = isPremiumLineManual(key, explicitManualKeys);
  const steps = buildSteps(key, premium, rating, inputs, calculated);

  return { title, steps, calculated, current, manual };
}

function buildSteps(
  key: keyof PremiumBreakdown,
  premium: PremiumBreakdown,
  rating: RatingSnapshot | undefined,
  inputs: PremiumWorkingInputs,
  calculated: number,
): PremiumWorkingStep[] {
  if (!rating) {
    return [
      step("Rating snapshot unavailable"),
      step("Current value", formatCurrency(premium[key] ?? 0)),
    ];
  }

  const c = calcBundle(rating, inputs);
  const turnover = inputs.estimatedTurnover;
  const τ = rating.terrorismRate;

  switch (key) {
    case "contractWorksCalculatedBasePremium":
      return [
        step("CW rate", formatRate(rating.contractWorksAppliedRate)),
        step("Estimated turnover", formatCurrency(turnover)),
        step(
          "CW rate × turnover",
          `${formatRate(rating.contractWorksAppliedRate)} × ${formatCurrency(turnover)}`,
        ),
        step("Result", formatCurrency(calculated)),
      ];
    case "liabilityCalculatedBasePremium":
      return [
        step("Liability rate", formatRate(rating.liabilityAppliedRate)),
        step("Estimated turnover", formatCurrency(turnover)),
        step(
          "Liability rate × turnover",
          `${formatRate(rating.liabilityAppliedRate)} × ${formatCurrency(turnover)}`,
        ),
        step("Result", formatCurrency(calculated)),
      ];
    case "contractWorksBasePremium":
      return [
        step("Calculated base", formatCurrency(c.cwCalc)),
        step("Minimum premium", formatCurrency(rating.contractWorksMinPremium)),
        step("Formula", "max(calculated, minimum)"),
        step("Result", formatCurrency(calculated)),
      ];
    case "liabilityBasePremium":
      return [
        step("Calculated base", formatCurrency(c.liabCalc)),
        step("Minimum premium", formatCurrency(rating.liabilityMinPremium)),
        step("Formula", "max(calculated, minimum)"),
        step("Result", formatCurrency(calculated)),
      ];
    case "contractWorksTerrorismPremium":
      return [
        step("Formula", "True Base Premium × Terrorism rate"),
        step("True Base Premium", formatCurrency(c.cwBase)),
        step("Terrorism rate (τ)", formatRate(τ)),
        step("Working", `${formatCurrency(c.cwBase)} × ${formatRate(τ)}`),
        step("Result", formatCurrency(calculated)),
        step(
          "Note",
          "Legacy server formula — Display Homes / Existing Structure are separate manual premium lines",
        ),
      ];
    case "contractWorksDisplayHomesPremium":
      return [
        step("Formula", "Manual premium line (not auto-calculated)"),
        step("Auto-calculated value", formatCurrency(0)),
        step(
          "Current value",
          formatCurrency(premium.contractWorksDisplayHomesPremium ?? 0),
        ),
      ];
    case "contractWorksExistingStructurePremium":
      return [
        step("Formula", "Manual premium line (not auto-calculated)"),
        step("Auto-calculated value", formatCurrency(0)),
        step(
          "Current value",
          formatCurrency(premium.contractWorksExistingStructurePremium ?? 0),
        ),
      ];
    case "contractWorksPlantPremium":
      return c.plantSteps;
    case "contractWorksPlantTerrorismPremium":
      return [
        step("Formula", "Plant premium > 0 ? Plant × τ : 0"),
        step("Plant premium", formatCurrency(c.plant)),
        step("Terrorism rate (τ)", formatRate(τ)),
        step("Result", formatCurrency(calculated)),
      ];
    case "contractWorksPlantESL":
      return [
        step(
          "Formula",
          "Plant > 0 ? (Plant + Plant terror) × ESL rate (construction e) : 0",
        ),
        step("Plant premium", formatCurrency(c.plant)),
        step("Plant terrorism", formatCurrency(c.plantTerror)),
        step("ESL rate (e)", formatRate(rating.eslRate)),
        step("Result", formatCurrency(calculated)),
      ];
    case "contractWorksESL":
      return [
        step("Formula", "(True Base + Terrorism Levy) × ESL rate"),
        step("True Base Premium", formatCurrency(c.cwBase)),
        step("Terrorism Levy", formatCurrency(c.terror)),
        step("ESL rate", formatRate(rating.eslRate)),
        step(
          "Working",
          `(${formatCurrency(c.cwBase)} + ${formatCurrency(c.terror)}) × ${formatRate(rating.eslRate)}`,
        ),
        step("Result", formatCurrency(calculated)),
      ];
    case "liabilityESL":
      return [
        step("Formula", "Always 0 for Section 2"),
        step("Result", formatCurrency(0)),
      ];
    case "contractWorksGST":
      return [
        step(
          "Formula",
          "(Base + Terror + Plant + Plant terror + Plant ESL + ESL) × 10%",
        ),
        step("True Base", formatCurrency(c.cwBase)),
        step("Terrorism", formatCurrency(c.terror)),
        step("Plant", formatCurrency(c.plant)),
        step("Plant terror", formatCurrency(c.plantTerror)),
        step("Plant ESL", formatCurrency(c.plantEsl)),
        step("ESL", formatCurrency(c.esl)),
        step("GST rate", "10%"),
        step("Result", formatCurrency(calculated)),
      ];
    case "liabilityGST":
      return [
        step("Formula", "(Liability base + ESL) × 10%"),
        step("Liability base", formatCurrency(c.liabBase)),
        step("Liability ESL", formatCurrency(c.liabEsl)),
        step("Result", formatCurrency(calculated)),
      ];
    case "contractWorksStampDuty":
      return [
        step(
          "Formula",
          "(Base + Terror + Plant + Plant terror + Plant ESL + ESL + GST) × Stamp duty rate",
        ),
        step(
          "Taxable (incl. GST)",
          formatCurrency(
            c.cwBase +
              c.terror +
              c.plant +
              c.plantTerror +
              c.plantEsl +
              c.esl +
              c.gst,
          ),
        ),
        step("Stamp duty rate", formatRate(rating.contractWorksStampDutyRate)),
        step("Result", formatCurrency(calculated)),
      ];
    case "liabilityStampDuty":
      return [
        step("Formula", "(Liability base + ESL + GST) × Stamp duty rate"),
        step("Taxable", formatCurrency(c.liabBase + c.liabEsl + c.liabGst)),
        step("Stamp duty rate", formatRate(rating.liabilityStampDutyRate)),
        step("Result", formatCurrency(calculated)),
      ];
    case "contractWorksTotalPremium":
      return [
        step("Sum of every Section 1 premium line"),
        step("True Base", formatCurrency(c.cwBase)),
        step("Terrorism", formatCurrency(c.terror)),
        step(
          "Display Homes",
          formatCurrency(premium.contractWorksDisplayHomesPremium ?? 0),
        ),
        step(
          "Existing Structure",
          formatCurrency(premium.contractWorksExistingStructurePremium ?? 0),
        ),
        step("Plant", formatCurrency(c.plant)),
        step("Plant terror", formatCurrency(c.plantTerror)),
        step("Plant ESL", formatCurrency(c.plantEsl)),
        step("ESL", formatCurrency(c.esl)),
        step("GST", formatCurrency(c.gst)),
        step("Stamp duty", formatCurrency(c.stamp)),
        step("Result", formatCurrency(calculated)),
      ];
    case "liabilityTotalPremium":
      return [
        step("Sum of Section 2 premium lines"),
        step("True Base", formatCurrency(c.liabBase)),
        step("ESL", formatCurrency(c.liabEsl)),
        step("GST", formatCurrency(c.liabGst)),
        step("Stamp duty", formatCurrency(c.liabStamp)),
        step("Result", formatCurrency(calculated)),
      ];
    case "originalTotalPremium":
      return [
        step("Formula", "Section 1 total + Section 2 total + Broker fees"),
        step(
          "Section 1",
          formatCurrency(
            c.cwTotal +
              (premium.contractWorksDisplayHomesPremium ?? 0) +
              (premium.contractWorksExistingStructurePremium ?? 0),
          ),
        ),
        step("Section 2", formatCurrency(c.liabTotal)),
        step("Broker fees", formatCurrency(c.brokerFee)),
        step("Result", formatCurrency(calculated)),
      ];
    case "combinedBrokerFee":
      return [
        step(
          "Broker fee total (incl. GST)",
          formatCurrency(inputs.brokerFeeTotal),
        ),
        step("Result", formatCurrency(calculated)),
      ];
    default:
      return [step("Current value", formatCurrency(premium[key] ?? 0))];
  }
}
