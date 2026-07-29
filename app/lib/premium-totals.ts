import type { PremiumBreakdown } from "~/lib/db/types";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Legacy combined True Base Premium (CARNewPolicy / CARViewPolicy):
 * Section1Base + Section1Terror (+ ES/DH + their terror) + Section2Base
 * + Plant + PlantTerror.
 *
 * Uses the stored terrorism / DH / ES premium lines as displayed (terrorism
 * may already include ES/DH terror from client recalc).
 */
export function combinedTrueBasePremium(premium: PremiumBreakdown): number {
  return (
    premium.contractWorksBasePremium +
    premium.liabilityBasePremium +
    premium.contractWorksTerrorismPremium +
    premium.contractWorksPlantPremium +
    premium.contractWorksPlantTerrorismPremium +
    (premium.contractWorksDisplayHomesPremium ?? 0) +
    (premium.contractWorksExistingStructurePremium ?? 0)
  );
}

/**
 * Recompute section / policy totals from every premium line (including manual
 * Display Homes and Existing Structure). Does not recalculate taxes.
 */
export function rollupPremiumTotals(
  premium: PremiumBreakdown,
): PremiumBreakdown {
  const displayHomes = premium.contractWorksDisplayHomesPremium ?? 0;
  const existingStructure = premium.contractWorksExistingStructurePremium ?? 0;
  const contractWorksTotalPremium = roundMoney(
    premium.contractWorksBasePremium +
      premium.contractWorksTerrorismPremium +
      displayHomes +
      existingStructure +
      premium.contractWorksPlantPremium +
      premium.contractWorksPlantTerrorismPremium +
      premium.contractWorksPlantESL +
      premium.contractWorksESL +
      premium.contractWorksGST +
      premium.contractWorksStampDuty,
  );
  const liabilityTotalPremium = roundMoney(
    premium.liabilityBasePremium +
      premium.liabilityESL +
      premium.liabilityGST +
      premium.liabilityStampDuty,
  );
  const originalTotalPremium = roundMoney(
    contractWorksTotalPremium +
      liabilityTotalPremium +
      premium.combinedBrokerFee,
  );

  return {
    ...premium,
    contractWorksTotalPremium,
    liabilityTotalPremium,
    originalTotalPremium,
  };
}
