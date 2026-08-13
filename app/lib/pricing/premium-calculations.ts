/**
 * Core premium calculation logic.
 * Extracted from premium-workings.ts to reduce file size.
 */

import type { RatingSnapshot } from "~/lib/db/types";
import { GST_RATE } from "~/constants";
import { plantPremium } from "./plant-premium-calc";
import type { PremiumWorkingInputs } from "./premium-workings";

export interface CalcBundle {
  cwCalc: number;
  cwBase: number;
  liabCalc: number;
  liabBase: number;
  terror: number;
  plant: number;
  plantTerror: number;
  plantEsl: number;
  esl: number;
  gst: number;
  stamp: number;
  cwTotal: number;
  liabEsl: number;
  liabGst: number;
  liabStamp: number;
  liabTotal: number;
  brokerFee: number;
  combined: number;
  plantSteps: Array<{ label: string; detail?: string }>;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate all premium components in a single bundle.
 * This is the core calculation engine that produces all premium values.
 */
export function calcBundle(
  rating: RatingSnapshot,
  inputs: PremiumWorkingInputs,
): CalcBundle {
  const turnover = inputs.estimatedTurnover;
  const cwCalc = roundMoney(rating.contractWorksAppliedRate * turnover);
  const cwBase = roundMoney(Math.max(cwCalc, rating.contractWorksMinPremium));
  const liabCalc = roundMoney(rating.liabilityAppliedRate * turnover);
  const liabBase = roundMoney(Math.max(liabCalc, rating.liabilityMinPremium));
  
  // Terrorism premium
  const terror = roundMoney(cwBase * rating.terrorismRate);
  
  // Plant equipment premium
  const plantResult = plantPremium({
    certificateDate: inputs.dateStart,
    plantEquipment: inputs.plantEquipment,
    contractWorksSumInsured: inputs.contractWorksSumInsured,
    plantRate: rating.plantRate,
    plantValueMin: rating.plantValueMin,
    plantValueMax: rating.plantValueMax,
  });
  const plant = plantResult.value;
  const plantTerror = plant > 0 ? roundMoney(plant * rating.terrorismRate) : 0;
  
  // Legacy: plant ESL uses construction ESL rate `e`, not PlantEslRate.
  const plantEsl =
    plant > 0 ? roundMoney((plant + plantTerror) * rating.eslRate) : 0;
  
  // Contract Works calculations
  const esl = roundMoney((cwBase + terror) * rating.eslRate);
  const gst = roundMoney(
    (cwBase + terror + plant + plantTerror + plantEsl + esl) * GST_RATE,
  );
  const stamp = roundMoney(
    (cwBase + terror + plant + plantTerror + plantEsl + esl + gst) *
      rating.contractWorksStampDutyRate,
  );
  const cwTotal = roundMoney(
    cwBase + terror + plant + plantTerror + plantEsl + esl + gst + stamp,
  );
  
  // Liability calculations
  const liabEsl = 0;
  const liabGst = roundMoney((liabBase + liabEsl) * GST_RATE);
  const liabStamp = roundMoney(
    (liabBase + liabEsl + liabGst) * rating.liabilityStampDutyRate,
  );
  const liabTotal = roundMoney(liabBase + liabEsl + liabGst + liabStamp);
  
  // Broker fee and combined total
  const brokerFee = roundMoney(inputs.brokerFeeTotal);
  const combined = roundMoney(cwTotal + liabTotal + brokerFee);

  return {
    cwCalc,
    cwBase,
    liabCalc,
    liabBase,
    terror,
    plant,
    plantTerror,
    plantEsl,
    esl,
    gst,
    stamp,
    cwTotal,
    liabEsl,
    liabGst,
    liabStamp,
    liabTotal,
    brokerFee,
    combined,
    plantSteps: plantResult.steps,
  };
}

/**
 * Calculate contract works premium without plant equipment.
 * Useful for scenarios where plant equipment is not applicable.
 */
export function calcContractWorksOnly(
  rating: RatingSnapshot,
  estimatedTurnover: number,
): {
  cwCalc: number;
  cwBase: number;
  terror: number;
  esl: number;
  gst: number;
  stamp: number;
  cwTotal: number;
} {
  const cwCalc = roundMoney(rating.contractWorksAppliedRate * estimatedTurnover);
  const cwBase = roundMoney(Math.max(cwCalc, rating.contractWorksMinPremium));
  const terror = roundMoney(cwBase * rating.terrorismRate);
  const esl = roundMoney((cwBase + terror) * rating.eslRate);
  const gst = roundMoney((cwBase + terror + esl) * GST_RATE);
  const stamp = roundMoney(
    (cwBase + terror + esl + gst) * rating.contractWorksStampDutyRate,
  );
  const cwTotal = roundMoney(cwBase + terror + esl + gst + stamp);

  return {
    cwCalc,
    cwBase,
    terror,
    esl,
    gst,
    stamp,
    cwTotal,
  };
}

/**
 * Calculate liability premium only.
 */
export function calcLiabilityOnly(
  rating: RatingSnapshot,
  estimatedTurnover: number,
): {
  liabCalc: number;
  liabBase: number;
  liabEsl: number;
  liabGst: number;
  liabStamp: number;
  liabTotal: number;
} {
  const liabCalc = roundMoney(rating.liabilityAppliedRate * estimatedTurnover);
  const liabBase = roundMoney(Math.max(liabCalc, rating.liabilityMinPremium));
  const liabEsl = 0;
  const liabGst = roundMoney((liabBase + liabEsl) * GST_RATE);
  const liabStamp = roundMoney(
    (liabBase + liabEsl + liabGst) * rating.liabilityStampDutyRate,
  );
  const liabTotal = roundMoney(liabBase + liabEsl + liabGst + liabStamp);

  return {
    liabCalc,
    liabBase,
    liabEsl,
    liabGst,
    liabStamp,
    liabTotal,
  };
}

/**
 * Calculate terrorism premium for a given base premium.
 */
export function calcTerrorismPremium(
  basePremium: number,
  terrorismRate: number,
): number {
  return roundMoney(basePremium * terrorismRate);
}

/**
 * Calculate ESL (Emergency Services Levy) for given premiums.
 */
export function calcEsl(
  contractWorksBasePremium: number,
  terrorismPremium: number,
  eslRate: number,
): number {
  return roundMoney((contractWorksBasePremium + terrorismPremium) * eslRate);
}

/**
 * Calculate GST for given premiums.
 */
export function calcGst(
  ...premiums: number[]
): number {
  const total = premiums.reduce((sum, p) => sum + p, 0);
  return roundMoney(total * GST_RATE);
}

/**
 * Calculate stamp duty for given premiums.
 */
export function calcStampDuty(
  premiums: number[],
  stampDutyRate: number,
): number {
  const total = premiums.reduce((sum, p) => sum + p, 0);
  return roundMoney(total * stampDutyRate);
}