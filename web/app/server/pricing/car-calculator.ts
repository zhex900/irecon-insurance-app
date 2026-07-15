import type { CarQuoteFormValues } from "~/lib/zod/policy-car";
import type { PremiumBreakdown } from "~/lib/db/types";
import {
  resolveEsl,
  resolvePlantRate,
  resolvePriceFile,
  resolveStampDuty,
  resolveTerrorism,
} from "~/server/pricing/rate-resolver";
import type {
  CarCalculatorResult,
  RatingSnapshot,
  Section2Value,
} from "~/server/pricing/types";

const GST_RATE = 0.1;
const TERROR_START_DATE = "2021-01-01";
const VERSION_21_START_DATE = "2023-01-01";
const PLANT_CERTIFICATE_TURNOVER_LIMIT = 2_500_000;

export function calculateCarPremium(
  input: CarQuoteFormValues,
  stateCode: string,
  brokerFeeTotal: number,
): CarCalculatorResult {
  const certificateDate = input.dateStart;
  const priceFile = resolvePriceFile(
    input.coverTypeId,
    input.estimatedTurnover,
    certificateDate,
  );
  const stampDuty = resolveStampDuty(stateCode, certificateDate);
  const esl = resolveEsl(stateCode, certificateDate);
  const plantRate = resolvePlantRate(certificateDate);
  const terrorism =
    certificateDate >= TERROR_START_DATE
      ? resolveTerrorism(input.postcode, stateCode, certificateDate)
      : null;

  const cwRate = priceFile?.cwRate ?? null;
  const cwMinPrem = priceFile?.cwMinPrem ?? 0;
  const liability = getLiabilityValues(
    input.section2Value as Section2Value,
    priceFile,
  );
  const sdRate = stampDuty?.rate ?? 0;
  const eslRate = esl?.constructionRate ?? 0;
  const eslPlantRate = esl?.plantRate ?? 0;
  const terrorismRate = terrorism?.rate ?? 0;
  const isTerrorismRateExist = terrorism != null;

  const section1BeforeBasePremium =
    cwRate != null ? cwRate * input.estimatedTurnover : 0;
  const section1TrueBasePremium = Math.max(
    section1BeforeBasePremium,
    cwMinPrem,
  );
  const section1DisplayHomes = input.displayHomes;
  const section1ExistingStructure = input.existingStructure;
  const section1BaseTerrorismPremium = section1TrueBasePremium * terrorismRate;
  const section1DisplayHomesTerror = section1DisplayHomes * terrorismRate;
  const section1ExistingStructureTerror =
    section1ExistingStructure * terrorismRate;
  const section1TerrorismPremium =
    section1BaseTerrorismPremium +
    section1DisplayHomesTerror +
    section1ExistingStructureTerror;
  const section1PlantEquipment = getSection1PlantEquipment({
    certificateDate,
    plantEquipment: input.plantEquipment,
    section1ContractWorksValue: input.section1Value,
    plantRate,
  });
  const section1PlantTerrorismPremium =
    section1PlantEquipment > 0 ? section1PlantEquipment * terrorismRate : 0;
  const section1PlantEsl =
    section1PlantEquipment > 0
      ? (section1PlantEquipment + section1PlantTerrorismPremium) * eslPlantRate
      : 0;
  const section1Esl =
    (section1TrueBasePremium +
      section1BaseTerrorismPremium +
      section1ExistingStructureTerror +
      section1ExistingStructure +
      section1DisplayHomes +
      section1DisplayHomesTerror) *
    eslRate;
  const section1Gst =
    (section1TrueBasePremium +
      section1BaseTerrorismPremium +
      section1ExistingStructureTerror +
      section1ExistingStructure +
      section1DisplayHomes +
      section1DisplayHomesTerror +
      section1PlantEquipment +
      section1PlantTerrorismPremium +
      section1PlantEsl +
      section1Esl) *
    GST_RATE;
  const section1Sd =
    (section1TrueBasePremium +
      section1BaseTerrorismPremium +
      section1ExistingStructureTerror +
      section1ExistingStructure +
      section1DisplayHomes +
      section1DisplayHomesTerror +
      section1PlantEquipment +
      section1PlantTerrorismPremium +
      section1PlantEsl +
      section1Esl +
      section1Gst) *
    sdRate;
  const section1TotalPremium =
    section1TrueBasePremium +
    section1BaseTerrorismPremium +
    section1ExistingStructureTerror +
    section1ExistingStructure +
    section1DisplayHomes +
    section1DisplayHomesTerror +
    section1PlantEquipment +
    section1PlantTerrorismPremium +
    section1PlantEsl +
    section1Esl +
    section1Gst +
    section1Sd;

  const section2BeforeBasePremium = liability.rate * input.estimatedTurnover;
  const section2TrueBasePremium = Math.max(
    section2BeforeBasePremium,
    liability.minPrem,
  );
  const section2Esl = 0;
  const section2Gst = (section2TrueBasePremium + section2Esl) * GST_RATE;
  const section2Sd =
    (section2TrueBasePremium + section2Esl + section2Gst) * sdRate;
  const section2TotalPremium =
    section2TrueBasePremium + section2Esl + section2Gst + section2Sd;

  const premium: PremiumBreakdown = {
    section1BeforeBasePremium: round(section1BeforeBasePremium),
    section1TrueBasePremium: round(section1TrueBasePremium),
    section1PlantEquipment: round(section1PlantEquipment),
    section1PlantEsl: round(section1PlantEsl),
    section1Esl: round(section1Esl),
    section1Gst: round(section1Gst),
    section1Sd: round(section1Sd),
    section1TerrorismPremium: round(section1TerrorismPremium),
    section1PlantTerrorismPremium: round(section1PlantTerrorismPremium),
    section1DisplayHomes: round(section1DisplayHomes),
    section1ExistingStructure: round(section1ExistingStructure),
    section1TotalPremium: round(section1TotalPremium),
    section2BeforeBasePremium: round(section2BeforeBasePremium),
    section2TrueBasePremium: round(section2TrueBasePremium),
    section2Esl: round(section2Esl),
    section2Gst: round(section2Gst),
    section2Sd: round(section2Sd),
    section2TotalPremium: round(section2TotalPremium),
    combinedBrokerFee: round(brokerFeeTotal),
    originalTotalPremium: round(
      section1TotalPremium + section2TotalPremium + brokerFeeTotal,
    ),
  };

  const rating: RatingSnapshot = {
    priceFileId: priceFile?.priceFileId ?? 0,
    stampDutyId: stampDuty?.priceFileStampDutyId ?? 0,
    eslId: esl?.priceFileEslId ?? 0,
    plantRate: plantRate?.rate ?? 0,
    eslRate,
    eslPlantRate,
    sdRateSection1: sdRate,
    sdRateSection2: sdRate,
    section1Rate: cwRate ?? 0,
    section2Rate: liability.rate,
    section1MinPrem: cwMinPrem,
    section2MinPrem: liability.minPrem,
    plantMinPrem: plantRate?.plantMinValue ?? 0,
    plantMaxPrem: plantRate?.plantMaxValue ?? 0,
    terrorismRate,
    terrorismTier: terrorism?.tier ?? "",
    isTerrorismRateExist,
  };

  const referralReasons = buildReferralReasons(input, rating, liability.label);

  return { premium, rating, referralReasons };
}

function getLiabilityValues(
  section2Value: Section2Value,
  priceFile: ReturnType<typeof resolvePriceFile>,
) {
  switch (section2Value) {
    case 1:
      return {
        rate: priceFile?.tenMilRate ?? 0,
        minPrem: priceFile?.tenMilMinPrem ?? 0,
        label: "$10 Million",
      };
    case 2:
      return {
        rate: priceFile?.twentyMilRate ?? 0,
        minPrem: priceFile?.twentyMilMinPrem ?? 0,
        label: "$20 Million",
      };
    default:
      return { rate: 0, minPrem: 0, label: "Not Insured" };
  }
}

function getSection1PlantEquipment({
  certificateDate,
  plantEquipment,
  section1ContractWorksValue,
  plantRate,
}: {
  certificateDate: string;
  plantEquipment: number;
  section1ContractWorksValue: number;
  plantRate: ReturnType<typeof resolvePlantRate>;
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
  input: CarQuoteFormValues,
  rating: RatingSnapshot,
  liabilityLabel: string,
) {
  const reasons: string[] = [];

  if (input.displayHomes > 0) {
    reasons.push(`Display Homes has a value of ${input.displayHomes}`);
  }
  if (input.existingStructure > 0) {
    reasons.push(
      `Existing Structure has a value of ${input.existingStructure}`,
    );
  }
  if (input.numberOfClaim >= 3) {
    reasons.push(
      `Number of claim last 3 years is entered with value ${input.numberOfClaim}`,
    );
  }
  if (input.anyClaimsExceed20k) {
    reasons.push("Any claims exceeded $20,000 in value is stated as yes");
  }
  if (!input.holdCurrentContractWorks) {
    reasons.push("Do not hold a current Contract Works/Liability policy");
  }
  if (input.plantEquipment > 50000) {
    reasons.push(
      "Named Insureds Construction Plant & Equipment is over 50,000",
    );
  }
  if (rating.section1Rate === 0) {
    reasons.push("Unable to find Contract Works rate");
  }
  if (input.section2Value !== 3 && rating.section2Rate === 0) {
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
