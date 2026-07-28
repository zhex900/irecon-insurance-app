import { calculatePremiumForPolicy } from "../app/lib/services/price/premium.service";
import {
  resolveBrokerFeeTotal,
  resolveEsl,
  resolvePlantRate,
  resolvePrice,
  resolveStampDuty,
} from "../app/server/pricing/rate-resolver";

async function main() {
  const price = await resolvePrice(1, 500000, "2025-06-01");
  const sd = await resolveStampDuty("NSW", "2025-06-01");
  const esl = await resolveEsl("NSW", "2025-06-01");
  const plant = await resolvePlantRate("2025-06-01");
  const fees = await resolveBrokerFeeTotal("2025-06-01");
  console.log("resolved", {
    cwRate: price?.cwRate,
    sd: sd?.rate,
    esl: esl?.constructionRate,
    plant: plant?.rate,
    fees,
  });

  const result = await calculatePremiumForPolicy({
    coverTypeId: 1,
    estimatedTurnover: 500000,
    contractWorksSumInsured: 500000,
    stateId: 2,
    postcode: "2000",
    dateStart: "2025-06-01",
    dateEnd: "2026-06-01",
    liabilityLimitBand: 1,
    displayHomes: 0,
    existingStructure: 0,
    plantEquipment: 0,
    claimsCountLast3Years: 0,
    anyClaimsExceed20k: false,
    hasExistingContractWorksCover: true,
    policyStatusId: 1,
    policyCategoryId: 1,
    insurerCode: "ATC",
    insuredName: "Test",
    siteAddress: "1 Test St",
    geographicalScopes: "",
    businessActivities: "",
  } as never);

  console.log("premium total", result.premium.originalTotalPremium);
  console.log("rating", {
    priceId: result.rating.priceId,
    stampDutyId: result.rating.stampDutyId,
    eslId: result.rating.eslId,
    cwRate: result.rating.contractWorksAppliedRate,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
