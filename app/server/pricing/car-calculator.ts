import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import {
  GST_RATE,
  PLANT_CERTIFICATE_TURNOVER_LIMIT,
  TERROR_START_DATE,
  VERSION_21_START_DATE,
} from "~/constants";
import {
  buildReferralReasons,
  liabilityLimitLabel,
} from "~/lib/pricing/referral-reasons";
import { rollupPremiumTotals } from "~/lib/pricing/premium-totals";
import {
  resolveEsl,
  resolvePlantRate,
  resolvePrice,
  resolveStampDuty,
  resolveTerrorism,
} from "~/server/pricing/rate-resolver";
import type {
  CarCalculatorResult,
  RatingSnapshot,
  LiabilityLimitBand,
  ResolvedPlant,
  ResolvedPrice,
} from "~/server/pricing/types";

export async function calculateCarPremium(
  input: CarPolicyFormValues,
  stateCode: string,
  brokerFeeTotal: number,
): Promise<CarCalculatorResult> {
  const certificateDate = input.dateStart;
  const [price, stampDuty, esl, plantRate, terrorism] = await Promise.all([
    resolvePrice(input.coverTypeId, input.estimatedTurnover, certificateDate),
    resolveStampDuty(stateCode, certificateDate),
    resolveEsl(stateCode, certificateDate),
    resolvePlantRate(certificateDate),
    certificateDate >= TERROR_START_DATE
      ? resolveTerrorism(input.postcode, stateCode, certificateDate)
      : Promise.resolve(null),
  ]);

  const cwRate = price?.cwRate ?? null;
  const cwMinPrem = price?.cwMinPrem ?? 0;
  const liability = getLiabilityValues(
    input.liabilityLimitBand as LiabilityLimitBand,
    price,
  );
  const sdRate = stampDuty?.rate ?? 0;
  const eslRate = esl?.constructionRate ?? 0;
  const plantEslRate = esl?.plantRate ?? 0;
  const terrorismRate = terrorism?.rate ?? 0;
  const isTerrorismRateExist = terrorism != null;

  // Round each line as it is produced (same chain as premium-workings / manual
  // recalc). Totals are the sum of those rounded lines — not round(sum of
  // unrounded floats), which can disagree by 1¢ with the breakdown.
  const contractWorksCalculatedBasePremium = round(
    cwRate != null ? cwRate * input.estimatedTurnover : 0,
  );
  const contractWorksBasePremium = round(
    Math.max(contractWorksCalculatedBasePremium, cwMinPrem),
  );
  // Legacy CARCalculator: Terrorism Levy = True Base Premium × τ only.
  // Display Homes / Existing Structure are manual premium lines (not SI → premium).
  const contractWorksDisplayHomesPremium = undefined;
  const contractWorksExistingStructurePremium = undefined;
  const contractWorksTerrorismPremium = round(
    contractWorksBasePremium * terrorismRate,
  );
  const contractWorksPlantPremium = round(
    getContractWorksPlantPremium({
      certificateDate,
      plantEquipment: input.plantEquipment,
      section1ContractWorksValue: input.contractWorksSumInsured,
      plantRate,
    }),
  );
  const contractWorksPlantTerrorismPremium =
    contractWorksPlantPremium > 0
      ? round(contractWorksPlantPremium * terrorismRate)
      : 0;
  // Legacy CARCalculator uses construction ESL rate `e` for plant ESL
  // (PlantEslRate is loaded/stored but not applied in server calc).
  const contractWorksPlantESL =
    contractWorksPlantPremium > 0
      ? round(
          (contractWorksPlantPremium + contractWorksPlantTerrorismPremium) *
            eslRate,
        )
      : 0;
  const contractWorksESL = round(
    (contractWorksBasePremium + contractWorksTerrorismPremium) * eslRate,
  );
  const contractWorksGST = round(
    (contractWorksBasePremium +
      contractWorksTerrorismPremium +
      contractWorksPlantPremium +
      contractWorksPlantTerrorismPremium +
      contractWorksPlantESL +
      contractWorksESL) *
      GST_RATE,
  );
  const contractWorksStampDuty = round(
    (contractWorksBasePremium +
      contractWorksTerrorismPremium +
      contractWorksPlantPremium +
      contractWorksPlantTerrorismPremium +
      contractWorksPlantESL +
      contractWorksESL +
      contractWorksGST) *
      sdRate,
  );

  const liabilityCalculatedBasePremium = round(
    liability.rate * input.estimatedTurnover,
  );
  const liabilityBasePremium = round(
    Math.max(liabilityCalculatedBasePremium, liability.minPrem),
  );
  const liabilityESL = 0;
  const liabilityGST = round((liabilityBasePremium + liabilityESL) * GST_RATE);
  const liabilityStampDuty = round(
    (liabilityBasePremium + liabilityESL + liabilityGST) * sdRate,
  );

  const premium = rollupPremiumTotals({
    contractWorksCalculatedBasePremium,
    contractWorksBasePremium,
    contractWorksPlantPremium,
    contractWorksPlantESL,
    contractWorksESL,
    contractWorksGST,
    contractWorksStampDuty,
    contractWorksTerrorismPremium,
    contractWorksPlantTerrorismPremium,
    contractWorksDisplayHomesPremium,
    contractWorksExistingStructurePremium,
    contractWorksTotalPremium: 0,
    liabilityCalculatedBasePremium,
    liabilityBasePremium,
    liabilityESL,
    liabilityGST,
    liabilityStampDuty,
    liabilityTotalPremium: 0,
    combinedBrokerFee: round(brokerFeeTotal),
    originalTotalPremium: 0,
  });

  const rating: RatingSnapshot = {
    priceId: price?.priceId ?? 0,
    stampDutyId: stampDuty?.priceStampDutyId ?? 0,
    eslId: esl?.priceEslId ?? 0,
    plantRate: plantRate?.rate ?? 0,
    eslRate,
    plantEslRate,
    contractWorksStampDutyRate: sdRate,
    liabilityStampDutyRate: sdRate,
    contractWorksAppliedRate: cwRate ?? 0,
    liabilityAppliedRate: liability.rate,
    contractWorksMinPremium: cwMinPrem,
    liabilityMinPremium: liability.minPrem,
    plantValueMin: plantRate?.plantMinValue ?? 0,
    plantValueMax: plantRate?.plantMaxValue ?? 0,
    terrorismRate,
    terrorismTier: terrorism?.tier ?? "",
    isTerrorismRateExist,
  };

  const referralReasons = buildReferralReasons(input, rating, liability.label);

  return { premium, rating, referralReasons };
}

function getLiabilityValues(
  liabilityLimitBand: LiabilityLimitBand,
  price: ResolvedPrice | null,
) {
  switch (liabilityLimitBand) {
    case 1:
      return {
        rate: price?.tenMilRate ?? 0,
        minPrem: price?.tenMilMinPrem ?? 0,
        label: liabilityLimitLabel(1),
      };
    case 2:
      return {
        rate: price?.twentyMilRate ?? 0,
        minPrem: price?.twentyMilMinPrem ?? 0,
        label: liabilityLimitLabel(2),
      };
    default:
      return { rate: 0, minPrem: 0, label: liabilityLimitLabel(3) };
  }
}

function getContractWorksPlantPremium({
  certificateDate,
  plantEquipment,
  section1ContractWorksValue,
  plantRate,
}: {
  certificateDate: string;
  plantEquipment: number;
  section1ContractWorksValue: number;
  plantRate: ResolvedPlant | null;
}) {
  if (!plantRate || plantEquipment <= 0) return 0;

  if (certificateDate >= VERSION_21_START_DATE) {
    return plantRate.rate * plantEquipment;
  }

  if (
    certificateDate < TERROR_START_DATE ||
    section1ContractWorksValue <= PLANT_CERTIFICATE_TURNOVER_LIMIT
  ) {
    if (plantEquipment > plantRate.plantMinValue) {
      if (plantEquipment > plantRate.plantMaxValue) {
        return (
          plantRate.rate * (plantRate.plantMaxValue - plantRate.plantMinValue)
        );
      }
      return plantRate.rate * (plantEquipment - plantRate.plantMinValue);
    }
    return 0;
  }

  if (plantEquipment > plantRate.plantMaxValue) {
    return plantRate.rate * plantRate.plantMaxValue;
  }
  return plantRate.rate * plantEquipment;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
