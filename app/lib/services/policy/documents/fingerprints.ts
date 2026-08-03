import type { Policy } from "~/lib/db/types";

/** Stable hash of fields that affect Schedule / ROA PDF content. */
export function reviewDocumentsFingerprint(policy: Policy): string {
  const premium = policy.car.premium;
  const car = policy.car;
  return [
    policy.policyNumber,
    policy.policyStatusId,
    policy.dateStart,
    policy.dateEnd,
    policy.stateId,
    policy.postcode,
    policy.insurerCode,
    car.insuredName,
    car.siteAddress,
    car.estimatedTurnover,
    car.contractWorksSumInsured,
    car.displayHomes,
    car.existingStructure,
    car.plantEquipment,
    car.liabilityLimitBand,
    car.businessActivities,
    car.insuredContracts,
    car.geographicalScopes,
    car.maximumConstructionPeriod,
    car.maximumMaintenancePeriod,
    JSON.stringify(car.subLimits ?? null),
    JSON.stringify(car.excesses ?? null),
    JSON.stringify(car.selectedWordingIds ?? null),
    JSON.stringify(car.customWordings ?? null),
    premium?.originalTotalPremium ?? "none",
    premium?.contractWorksTotalPremium ?? "none",
    premium?.liabilityTotalPremium ?? "none",
    premium?.contractWorksDisplayHomesPremium ?? "none",
    premium?.contractWorksExistingStructurePremium ?? "none",
    premium?.contractWorksBasePremium ?? "none",
    premium?.contractWorksTerrorismPremium ?? "none",
    premium?.contractWorksPlantPremium ?? "none",
    premium?.contractWorksPlantTerrorismPremium ?? "none",
    premium?.contractWorksESL ?? "none",
    premium?.contractWorksStampDuty ?? "none",
    premium?.liabilityBasePremium ?? "none",
    premium?.liabilityESL ?? "none",
    premium?.liabilityStampDuty ?? "none",
  ].join("|");
}

export function adjustmentDocumentsFingerprint(policy: Policy): string {
  const adj = policy.car.adjustment;
  return [
    "adjustment",
    policy.policyNumber,
    adj?.adjustedTurnover ?? "none",
    adj?.adjustedTotalPremium ?? "none",
    adj?.stampDutyExempt ? "exempt" : "liable",
    adj?.adjustedDate ?? "none",
  ].join("|");
}
