import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import type { PremiumBreakdown } from "~/lib/db/types";
import { formatCurrency } from "~/lib/utils";
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

const GST_RATE = 0.1;
const TERROR_START_DATE = "2021-01-01";
const VERSION_21_START_DATE = "2023-01-01";
const PLANT_CERTIFICATE_TURNOVER_LIMIT = 2_500_000;

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

  const contractWorksCalculatedBasePremium =
    cwRate != null ? cwRate * input.estimatedTurnover : 0;
  const contractWorksBasePremium = Math.max(
    contractWorksCalculatedBasePremium,
    cwMinPrem,
  );
  const contractWorksDisplayHomesPremium = input.displayHomes;
  const contractWorksExistingStructurePremium = input.existingStructure;
  const section1BaseTerrorismPremium = contractWorksBasePremium * terrorismRate;
  const contractWorksDisplayHomesPremiumTerror =
    contractWorksDisplayHomesPremium * terrorismRate;
  const contractWorksExistingStructurePremiumTerror =
    contractWorksExistingStructurePremium * terrorismRate;
  const contractWorksTerrorismPremium =
    section1BaseTerrorismPremium +
    contractWorksDisplayHomesPremiumTerror +
    contractWorksExistingStructurePremiumTerror;
  const contractWorksPlantPremium = getContractWorksPlantPremium({
    certificateDate,
    plantEquipment: input.plantEquipment,
    section1ContractWorksValue: input.contractWorksSumInsured,
    plantRate,
  });
  const contractWorksPlantTerrorismPremium =
    contractWorksPlantPremium > 0
      ? contractWorksPlantPremium * terrorismRate
      : 0;
  const contractWorksPlantESL =
    contractWorksPlantPremium > 0
      ? (contractWorksPlantPremium + contractWorksPlantTerrorismPremium) *
        plantEslRate
      : 0;
  const contractWorksESL =
    (contractWorksBasePremium +
      section1BaseTerrorismPremium +
      contractWorksExistingStructurePremiumTerror +
      contractWorksExistingStructurePremium +
      contractWorksDisplayHomesPremium +
      contractWorksDisplayHomesPremiumTerror) *
    eslRate;
  const contractWorksGST =
    (contractWorksBasePremium +
      section1BaseTerrorismPremium +
      contractWorksExistingStructurePremiumTerror +
      contractWorksExistingStructurePremium +
      contractWorksDisplayHomesPremium +
      contractWorksDisplayHomesPremiumTerror +
      contractWorksPlantPremium +
      contractWorksPlantTerrorismPremium +
      contractWorksPlantESL +
      contractWorksESL) *
    GST_RATE;
  const contractWorksStampDuty =
    (contractWorksBasePremium +
      section1BaseTerrorismPremium +
      contractWorksExistingStructurePremiumTerror +
      contractWorksExistingStructurePremium +
      contractWorksDisplayHomesPremium +
      contractWorksDisplayHomesPremiumTerror +
      contractWorksPlantPremium +
      contractWorksPlantTerrorismPremium +
      contractWorksPlantESL +
      contractWorksESL +
      contractWorksGST) *
    sdRate;
  const contractWorksTotalPremium =
    contractWorksBasePremium +
    section1BaseTerrorismPremium +
    contractWorksExistingStructurePremiumTerror +
    contractWorksExistingStructurePremium +
    contractWorksDisplayHomesPremium +
    contractWorksDisplayHomesPremiumTerror +
    contractWorksPlantPremium +
    contractWorksPlantTerrorismPremium +
    contractWorksPlantESL +
    contractWorksESL +
    contractWorksGST +
    contractWorksStampDuty;

  const liabilityCalculatedBasePremium =
    liability.rate * input.estimatedTurnover;
  const liabilityBasePremium = Math.max(
    liabilityCalculatedBasePremium,
    liability.minPrem,
  );
  const liabilityESL = 0;
  const liabilityGST = (liabilityBasePremium + liabilityESL) * GST_RATE;
  const liabilityStampDuty =
    (liabilityBasePremium + liabilityESL + liabilityGST) * sdRate;
  const liabilityTotalPremium =
    liabilityBasePremium + liabilityESL + liabilityGST + liabilityStampDuty;

  const premium: PremiumBreakdown = {
    contractWorksCalculatedBasePremium: round(
      contractWorksCalculatedBasePremium,
    ),
    contractWorksBasePremium: round(contractWorksBasePremium),
    contractWorksPlantPremium: round(contractWorksPlantPremium),
    contractWorksPlantESL: round(contractWorksPlantESL),
    contractWorksESL: round(contractWorksESL),
    contractWorksGST: round(contractWorksGST),
    contractWorksStampDuty: round(contractWorksStampDuty),
    contractWorksTerrorismPremium: round(contractWorksTerrorismPremium),
    contractWorksPlantTerrorismPremium: round(
      contractWorksPlantTerrorismPremium,
    ),
    contractWorksDisplayHomesPremium: round(contractWorksDisplayHomesPremium),
    contractWorksExistingStructurePremium: round(
      contractWorksExistingStructurePremium,
    ),
    contractWorksTotalPremium: round(contractWorksTotalPremium),
    liabilityCalculatedBasePremium: round(liabilityCalculatedBasePremium),
    liabilityBasePremium: round(liabilityBasePremium),
    liabilityESL: round(liabilityESL),
    liabilityGST: round(liabilityGST),
    liabilityStampDuty: round(liabilityStampDuty),
    liabilityTotalPremium: round(liabilityTotalPremium),
    combinedBrokerFee: round(brokerFeeTotal),
    originalTotalPremium: round(
      contractWorksTotalPremium + liabilityTotalPremium + brokerFeeTotal,
    ),
  };

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
        label: "$10 Million",
      };
    case 2:
      return {
        rate: price?.twentyMilRate ?? 0,
        minPrem: price?.twentyMilMinPrem ?? 0,
        label: "$20 Million",
      };
    default:
      return { rate: 0, minPrem: 0, label: "Not Insured" };
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

function buildReferralReasons(
  input: CarPolicyFormValues,
  rating: RatingSnapshot,
  liabilityLabel: string,
) {
  const reasons: string[] = [];

  if (input.displayHomes > 0) {
    reasons.push(
      `Display Homes has a value of ${formatCurrency(input.displayHomes)}`,
    );
  }
  if (input.existingStructure > 0) {
    reasons.push(
      `Existing Structure has a value of ${formatCurrency(input.existingStructure)}`,
    );
  }
  if (input.claimsCountLast3Years >= 3) {
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
  if (input.plantEquipment > 50000) {
    reasons.push(
      "Named Insureds Construction Plant & Equipment is over 50,000",
    );
  }
  if (rating.contractWorksAppliedRate === 0) {
    reasons.push("Unable to find Contract Works rate");
  }
  if (input.liabilityLimitBand !== 3 && rating.liabilityAppliedRate === 0) {
    reasons.push(`Unable to find Liability rate for ${liabilityLabel}`);
  }
  if (rating.stampDutyId === 0) {
    reasons.push("Unable to find the SD rate");
  }
  if (rating.eslId === 0) {
    reasons.push("Unable to find the ESL rate");
  }
  if (!rating.isTerrorismRateExist && input.dateStart >= TERROR_START_DATE) {
    reasons.push(
      "Unable to find terrorism rate for this combination of postcode/State",
    );
  }

  return reasons;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
