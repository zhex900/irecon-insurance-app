import type { z } from "zod";

import type { Policy } from "~/lib/db/types";
import {
  flatCustomWordings,
  normalizeCustomWordings,
} from "~/lib/policies/custom-wordings";
import { resolvePolicyNumberForSave } from "~/lib/policies/policy-number";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import { carPolicyDraftSchema,isTerminalStatus, POLICY_STATUS  } from "~/lib/zod/policy-car";

type DraftValues = z.infer<typeof carPolicyDraftSchema>;

/** Merge form values into an existing policy (draft save). */
export function mergeDraftIntoPolicy(
  existing: Policy,
  values: DraftValues,
): Policy {
  const customWordings = values.customWordings
    ? normalizeCustomWordings(values.customWordings)
    : (existing.car.customWordings ?? []);

  const premiumOverride =
    values.premium && typeof values.premium === "object"
      ? ({
          ...existing.car.premium,
          ...values.premium,
        } as Policy["car"]["premium"])
      : existing.car.premium;

  // After Submit, blur-saves must not flip the policy back to draft (that
  // unpins Premium and resets status). True drafts stay Pending + isDraft.
  const keepSubmitted = !existing.isDraft;

  return {
    ...existing,
    policyCategoryId: values.policyCategoryId ?? existing.policyCategoryId,
    policyStatusId: keepSubmitted
      ? existing.policyStatusId
      : POLICY_STATUS.Pending,
    policyNumber: resolvePolicyNumberForSave(
      existing.policyNumber,
      values.policyNumber,
      isTerminalStatus(existing.policyStatusId),
    ),
    postcode: values.postcode ?? existing.postcode,
    stateId:
      values.stateId != null && Number(values.stateId) > 0
        ? Number(values.stateId)
        : existing.stateId,
    dateStart: values.dateStart ?? existing.dateStart,
    dateEnd: values.dateEnd ?? existing.dateEnd,
    dateEffective: values.dateStart ?? existing.dateEffective,
    insurerCode: values.insurerCode ?? existing.insurerCode,
    isDraft: existing.isDraft,
    car: {
      ...existing.car,
      coverTypeId: values.coverTypeId ?? existing.car.coverTypeId,
      annualCoverTypeId:
        (values.coverTypeId ?? existing.car.coverTypeId) === 1
          ? (() => {
              const next = values.annualCoverTypeId;
              if (next == null || Number(next) === 0) {
                return existing.car.annualCoverTypeId ?? null;
              }
              return Number(next);
            })()
          : null,
      siteAddress: values.siteAddress ?? existing.car.siteAddress,
      insuredName: values.insuredName ?? existing.car.insuredName,
      estimatedTurnover:
        values.estimatedTurnover ?? existing.car.estimatedTurnover,
      businessActivities:
        values.businessActivities ?? existing.car.businessActivities,
      insuredContracts:
        values.insuredContracts ?? existing.car.insuredContracts,
      geographicalScopes:
        values.geographicalScopes ?? existing.car.geographicalScopes,
      plantEquipment: values.plantEquipment ?? existing.car.plantEquipment,
      existingStructure:
        values.existingStructure ?? existing.car.existingStructure,
      displayHomes: values.displayHomes ?? existing.car.displayHomes,
      // Premium lines stay on the premium breakdown — not the risk sum-insured.
      contractWorksExistingStructurePremium:
        premiumOverride?.contractWorksExistingStructurePremium ??
        existing.car.contractWorksExistingStructurePremium,
      contractWorksDisplayHomesPremium:
        premiumOverride?.contractWorksDisplayHomesPremium ??
        existing.car.contractWorksDisplayHomesPremium,
      claimsCountLast3Years:
        values.claimsCountLast3Years ?? existing.car.claimsCountLast3Years,
      anyClaimsExceed20k:
        values.anyClaimsExceed20k ?? existing.car.anyClaimsExceed20k,
      declarationConfirmed:
        values.declarationConfirmed ?? existing.car.declarationConfirmed,
      contractWorksSumInsured:
        values.contractWorksSumInsured ?? existing.car.contractWorksSumInsured,
      liabilityLimitBand:
        values.liabilityLimitBand != null &&
        Number(values.liabilityLimitBand) > 0
          ? Number(values.liabilityLimitBand)
          : existing.car.liabilityLimitBand,
      hasExistingContractWorksCover:
        values.hasExistingContractWorksCover === undefined
          ? existing.car.hasExistingContractWorksCover
          : Boolean(values.hasExistingContractWorksCover),
      currentInsurer:
        values.hasExistingContractWorksCover === true
          ? (values.currentInsurer ?? existing.car.currentInsurer)
          : values.hasExistingContractWorksCover === false
            ? ""
            : (values.currentInsurer ?? existing.car.currentInsurer),
      maximumConstructionPeriod:
        values.maximumConstructionPeriod ??
        existing.car.maximumConstructionPeriod,
      maximumMaintenancePeriod:
        values.maximumMaintenancePeriod ??
        existing.car.maximumMaintenancePeriod,
      subLimits: values.subLimits
        ? { ...existing.car.subLimits, ...values.subLimits }
        : existing.car.subLimits,
      excesses: values.excesses
        ? {
            ...existing.car.excesses,
            ...values.excesses,
            excessAdditionalNotes: values.excesses.excessAdditionalNotes ?? "",
          }
        : existing.car.excesses,
      excludedContracts1:
        values.excludedContracts1 ?? existing.car.excludedContracts1,
      excludedContracts2:
        values.excludedContracts2 ?? existing.car.excludedContracts2,
      excludedContracts3:
        values.excludedContracts3 ?? existing.car.excludedContracts3,
      selectedWordingIds:
        values.selectedWordingIds ?? existing.car.selectedWordingIds,
      customWordings,
      ...flatCustomWordings(customWordings),
      premium: premiumOverride,
      premiumManualKeys:
        values.premiumManualKeys !== undefined
          ? values.premiumManualKeys
          : existing.car.premiumManualKeys,
    },
  };
}

// silence unused — kept for call sites that pass full form values
export type { CarPolicyFormValues };
