import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { normalizeExcesses } from "~/lib/excesses";
import { normalizeSubLimits } from "~/lib/sub-limits";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

/**
 * Merge live wizard form values into a policy snapshot for document generation.
 * Prefer form fields over the last-loaded policy so unsaved edits appear in PDFs.
 */
export function policySnapshotFromForm(
  policy: Policy,
  values: CarPolicyFormValues,
  options?: {
    premium?: PremiumBreakdown;
    rating?: Policy["car"]["rating"];
    referralReasons?: string[];
    documents?: Policy["documents"];
  },
): Policy {
  const premium = options?.premium ?? policy.car.premium;
  const customWordings =
    values.customWordings ?? policy.car.customWordings ?? [];

  return {
    ...policy,
    policyCategoryId: values.policyCategoryId ?? policy.policyCategoryId,
    policyStatusId: values.policyStatusId ?? policy.policyStatusId,
    policyNumber:
      values.policyCategoryId === 2 && values.policyNumber
        ? values.policyNumber
        : policy.policyNumber,
    postcode: values.postcode ?? policy.postcode,
    stateId: values.stateId ?? policy.stateId,
    dateStart: values.dateStart ?? policy.dateStart,
    dateEnd: values.dateEnd ?? policy.dateEnd,
    dateEffective: values.dateStart ?? policy.dateEffective,
    insurerCode: values.insurerCode ?? policy.insurerCode,
    documents: options?.documents ?? policy.documents,
    car: {
      ...policy.car,
      coverTypeId: values.coverTypeId ?? policy.car.coverTypeId,
      annualCoverTypeId:
        (values.coverTypeId ?? policy.car.coverTypeId) === 1
          ? (values.annualCoverTypeId ?? policy.car.annualCoverTypeId ?? null)
          : null,
      siteAddress: values.siteAddress ?? policy.car.siteAddress,
      insuredName: values.insuredName ?? policy.car.insuredName,
      estimatedTurnover:
        values.estimatedTurnover ?? policy.car.estimatedTurnover,
      businessActivities:
        values.businessActivities ?? policy.car.businessActivities,
      insuredContracts: values.insuredContracts ?? policy.car.insuredContracts,
      geographicalScopes:
        values.geographicalScopes ?? policy.car.geographicalScopes,
      plantEquipment: values.plantEquipment ?? policy.car.plantEquipment,
      existingStructure:
        values.existingStructure ?? policy.car.existingStructure,
      displayHomes: values.displayHomes ?? policy.car.displayHomes,
      claimsCountLast3Years:
        values.claimsCountLast3Years ?? policy.car.claimsCountLast3Years,
      anyClaimsExceed20k:
        values.anyClaimsExceed20k ?? policy.car.anyClaimsExceed20k,
      declarationConfirmed:
        values.declarationConfirmed ?? policy.car.declarationConfirmed,
      contractWorksSumInsured:
        values.contractWorksSumInsured ?? policy.car.contractWorksSumInsured,
      liabilityLimitBand:
        values.liabilityLimitBand ?? policy.car.liabilityLimitBand,
      hasExistingContractWorksCover:
        values.hasExistingContractWorksCover ??
        policy.car.hasExistingContractWorksCover,
      currentInsurer:
        values.hasExistingContractWorksCover === true
          ? (values.currentInsurer ?? policy.car.currentInsurer)
          : values.hasExistingContractWorksCover === false
            ? ""
            : (values.currentInsurer ?? policy.car.currentInsurer),
      maximumConstructionPeriod:
        values.maximumConstructionPeriod ??
        policy.car.maximumConstructionPeriod,
      maximumMaintenancePeriod:
        values.maximumMaintenancePeriod ?? policy.car.maximumMaintenancePeriod,
      subLimits: values.subLimits
        ? normalizeSubLimits({
            ...policy.car.subLimits,
            ...values.subLimits,
          })
        : policy.car.subLimits,
      excesses: values.excesses
        ? normalizeExcesses({
            ...policy.car.excesses,
            ...values.excesses,
            excessAdditionalNotes: values.excesses.excessAdditionalNotes ?? "",
          })
        : policy.car.excesses,
      excludedContracts1:
        values.excludedContracts1 ?? policy.car.excludedContracts1,
      excludedContracts2:
        values.excludedContracts2 ?? policy.car.excludedContracts2,
      excludedContracts3:
        values.excludedContracts3 ?? policy.car.excludedContracts3,
      selectedWordingIds:
        values.selectedWordingIds ?? policy.car.selectedWordingIds,
      customWordings,
      referralReasons: options?.referralReasons ?? policy.car.referralReasons,
      premium,
      rating: options?.rating ?? policy.car.rating,
    },
  };
}
