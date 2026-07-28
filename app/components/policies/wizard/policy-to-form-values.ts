import type { Policy } from "~/lib/db/types";
import { normalizeExcesses } from "~/lib/excesses";
import { normalizeSubLimits } from "~/lib/sub-limits";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

export function policyToFormValues(policy: Policy): CarPolicyFormValues {
  /** Draft DB rows use 0 as placeholders — show empty until the broker enters a value. */
  const blankZeros = Boolean(policy.isDraft);
  const numOrEmpty = (value: number): number | ("" & {}) =>
    blankZeros && value === 0 ? ("" as never) : value;

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
    estimatedTurnover: numOrEmpty(policy.car.estimatedTurnover) as number,
    postcode: policy.postcode,
    stateId: (policy.stateId === 0 ? "" : policy.stateId) as number,
    businessActivities: policy.car.businessActivities,
    insuredContracts: policy.car.insuredContracts,
    geographicalScopes: policy.car.geographicalScopes,
    maximumConstructionPeriod: policy.car.maximumConstructionPeriod,
    maximumMaintenancePeriod: policy.car.maximumMaintenancePeriod,
    dateStart: policy.dateStart,
    dateEnd: policy.dateEnd,
    hasExistingContractWorksCover: policy.car.hasExistingContractWorksCover,
    currentInsurer: policy.car.currentInsurer,
    contractWorksSumInsured: numOrEmpty(
      policy.car.contractWorksSumInsured,
    ) as number,
    displayHomes: numOrEmpty(policy.car.displayHomes) as number,
    existingStructure: numOrEmpty(policy.car.existingStructure) as number,
    section1DisplayHomes: "" as unknown as number,
    section1ExistingStructure: "" as unknown as number,
    plantEquipment: numOrEmpty(policy.car.plantEquipment) as number,
    liabilityLimitBand: policy.car.liabilityLimitBand,
    claimsCountLast3Years: numOrEmpty(
      policy.car.claimsCountLast3Years,
    ) as number,
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
