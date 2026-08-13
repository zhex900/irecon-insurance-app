import type { Policy } from "~/lib/db/types";
import { normalizeExcesses } from "~/lib/policies/excesses";
import { normalizeSubLimits } from "~/lib/policies/sub-limits";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

export function policyToFormValues(policy: Policy): Partial<CarPolicyFormValues> {
  /** Draft DB rows use 0 as money placeholders — show empty until entered. */
  const blankZeros = Boolean(policy.isDraft);
  const moneyOrEmpty = (value: number): number | undefined =>
    blankZeros && value === 0 ? undefined : value;
  /**
   * Sum-insured style amounts where 0 is a real answer ("none"), not a
   * draft placeholder — keep showing 0 even on drafts.
   */
  const moneyKeepZero = (value: number): number => value;

  return {
    clientId: policy.clientId,
    policyStatusId: policy.policyStatusId,
    insurerCode: policy.insurerCode,
    insuredName: policy.car.insuredName,
    coverTypeId: policy.car.coverTypeId,
    annualCoverTypeId: policy.car.annualCoverTypeId ?? null,
    policyCategoryId: policy.policyCategoryId,
    policyNumber: policy.policyNumber,
    siteAddress: policy.car.siteAddress,
    estimatedTurnover: moneyOrEmpty(policy.car.estimatedTurnover),
    postcode: policy.postcode,
    stateId: policy.stateId === 0 ? undefined : policy.stateId,
    businessActivities: policy.car.businessActivities,
    insuredContracts: policy.car.insuredContracts,
    geographicalScopes: policy.car.geographicalScopes,
    maximumConstructionPeriod: policy.car.maximumConstructionPeriod,
    maximumMaintenancePeriod: policy.car.maximumMaintenancePeriod,
    dateStart: policy.dateStart,
    dateEnd: policy.dateEnd,
    hasExistingContractWorksCover: policy.car.hasExistingContractWorksCover,
    currentInsurer: policy.car.currentInsurer,
    contractWorksSumInsured: moneyOrEmpty(policy.car.contractWorksSumInsured),
    displayHomes: moneyKeepZero(policy.car.displayHomes),
    existingStructure: moneyKeepZero(policy.car.existingStructure),
    section1DisplayHomes: undefined,
    section1ExistingStructure: undefined,
    plantEquipment: moneyKeepZero(policy.car.plantEquipment),
    liabilityLimitBand: policy.car.liabilityLimitBand,
    // 0 is a real answer ("no claims") — never treat as an empty placeholder.
    claimsCountLast3Years: policy.car.claimsCountLast3Years,
    anyClaimsExceed20k: policy.car.anyClaimsExceed20k,
    declarationConfirmed: policy.car.declarationConfirmed,
    subLimits: normalizeSubLimits(policy.car.subLimits),
    excesses: normalizeExcesses(policy.car.excesses),
    excludedContracts1: policy.car.excludedContracts1,
    excludedContracts2: policy.car.excludedContracts2,
    excludedContracts3: policy.car.excludedContracts3,
    selectedWordingIds: policy.car.selectedWordingIds,
    customWordings: policy.car.customWordings ?? [],
  };
}
