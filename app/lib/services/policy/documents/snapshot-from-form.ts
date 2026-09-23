import type { CarWording, Policy, PremiumBreakdown } from "~/lib/db/types";
import { collectEndorsementWordings } from "~/lib/pdf/merge-fields";
import { normalizeExcesses } from "~/lib/policies/excesses";
import { resolvePolicyNumberForSave } from "~/lib/policies/policy-number";
import { normalizeSubLimits } from "~/lib/policies/sub-limits";
import { coerceFormBoolean } from "~/lib/pricing/referral-reasons";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import { isTerminalStatus } from "~/lib/zod/policy-car";

/** Prefer a finite form money value; fall back when blank/NaN (not when 0). */
function pickMoney(formValue: unknown, fallback: number): number {
  if (formValue === "" || formValue == null) return fallback;
  const n = typeof formValue === "number" ? formValue : Number(formValue);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Merge live wizard form values into a policy snapshot for document generation.
 * Prefer form fields over the last-loaded policy so unsaved edits appear in PDFs.
 */
export function policySnapshotFromForm(
  policy: Policy,
  values: CarPolicyFormValues,
  options?: {
    premium?: PremiumBreakdown;
    /** Session keys for Premium Breakdown click-edits (Excel / draft). */
    premiumManualKeys?: string[];
    rating?: Policy["car"]["rating"];
    referralReasons?: string[];
    documents?: Policy["documents"];
    /** Same fixed Additional Wording catalogue shown in the wizard checkboxes. */
    carWording?: CarWording[];
  },
): Policy {
  const premium = options?.premium ?? policy.car.premium;
  const premiumManualKeys =
    options?.premiumManualKeys ?? policy.car.premiumManualKeys;
  const selectedWordingIds = Array.isArray(values.selectedWordingIds)
    ? values.selectedWordingIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    : (policy.car.selectedWordingIds ?? []);
  const wordingCatalogue = options?.carWording ?? [];
  const customWordings =
    values.customWordings ?? policy.car.customWordings ?? [];

  return {
    ...policy,
    policyCategoryId: values.policyCategoryId ?? policy.policyCategoryId,
    policyStatusId: values.policyStatusId ?? policy.policyStatusId,
    policyNumber: resolvePolicyNumberForSave(
      policy.policyNumber,
      values.policyNumber,
      isTerminalStatus(policy.policyStatusId),
    ),
    postcode: values.postcode ?? policy.postcode,
    stateId: values.stateId ?? policy.stateId,
    dateStart: values.dateStart ?? policy.dateStart,
    dateEnd: values.dateEnd ?? policy.dateEnd,
    dateEffective: values.dateStart ?? policy.dateEffective,
    insurerCode: values.insurerCode ?? policy.insurerCode,
    documents: options?.documents ?? policy.documents,
    car: {
      ...policy.car,
      coverTypeId: (() => {
        const raw = values.coverTypeId ?? policy.car.coverTypeId;
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : policy.car.coverTypeId;
      })(),
      annualCoverTypeId: (() => {
        const raw = values.coverTypeId ?? policy.car.coverTypeId;
        const coverTypeId = Number(raw);
        if (coverTypeId !== 1) return null;
        return values.annualCoverTypeId ?? policy.car.annualCoverTypeId ?? null;
      })(),
      siteAddress: values.siteAddress ?? policy.car.siteAddress,
      insuredName: values.insuredName ?? policy.car.insuredName,
      estimatedTurnover: pickMoney(
        values.estimatedTurnover,
        policy.car.estimatedTurnover,
      ),
      businessActivities:
        values.businessActivities ?? policy.car.businessActivities,
      insuredContracts: values.insuredContracts ?? policy.car.insuredContracts,
      geographicalScopes:
        values.geographicalScopes ?? policy.car.geographicalScopes,
      plantEquipment: pickMoney(
        values.plantEquipment,
        policy.car.plantEquipment,
      ),
      existingStructure: pickMoney(
        values.existingStructure,
        policy.car.existingStructure,
      ),
      displayHomes: pickMoney(values.displayHomes, policy.car.displayHomes),
      claimsCountLast3Years:
        values.claimsCountLast3Years ?? policy.car.claimsCountLast3Years,
      anyClaimsExceed20k:
        coerceFormBoolean(values.anyClaimsExceed20k) ??
        policy.car.anyClaimsExceed20k,
      declarationConfirmed:
        coerceFormBoolean(values.declarationConfirmed) ??
        policy.car.declarationConfirmed,
      contractWorksSumInsured: pickMoney(
        values.contractWorksSumInsured,
        policy.car.contractWorksSumInsured,
      ),
      liabilityLimitBand: (() => {
        const raw = values.liabilityLimitBand;
        const n = raw == null ? NaN : Number(raw);
        return Number.isFinite(n) && n > 0 ? n : policy.car.liabilityLimitBand;
      })(),
      hasExistingContractWorksCover:
        coerceFormBoolean(values.hasExistingContractWorksCover) ??
        policy.car.hasExistingContractWorksCover,
      currentInsurer: (() => {
        const hold = coerceFormBoolean(values.hasExistingContractWorksCover);
        if (hold === true) {
          return values.currentInsurer ?? policy.car.currentInsurer;
        }
        if (hold === false) return "";
        return values.currentInsurer ?? policy.car.currentInsurer;
      })(),
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
        ? normalizeExcesses(
            {
              ...policy.car.excesses,
              ...values.excesses,
              excessAdditionalNotes: values.excesses.excessAdditionalNotes ?? "",
              excessLegalLiabilityAdditionalNotes:
                values.excesses.excessLegalLiabilityAdditionalNotes ?? "",
            },
            {
              contractWorksSumInsured: pickMoney(
                values.contractWorksSumInsured,
                policy.car.contractWorksSumInsured,
              ),
              liabilityLimitBand:
                values.liabilityLimitBand ?? policy.car.liabilityLimitBand,
            },
          )
        : policy.car.excesses,
      excludedContracts1:
        values.excludedContracts1 ?? policy.car.excludedContracts1,
      excludedContracts2:
        values.excludedContracts2 ?? policy.car.excludedContracts2,
      excludedContracts3:
        values.excludedContracts3 ?? policy.car.excludedContracts3,
      selectedWordingIds,
      customWordings,
      // Ticked catalogue rows + custom pairs for the Endorsements table merge.
      endorsementWordings: collectEndorsementWordings(
        {
          selectedWordingIds,
          customWordings,
          customWordingSubject: policy.car.customWordingSubject,
          customWordingContent: policy.car.customWordingContent,
          customWordingSubject2: policy.car.customWordingSubject2,
          customWordingContent2: policy.car.customWordingContent2,
        },
        wordingCatalogue,
      ),
      referralReasons: options?.referralReasons ?? policy.car.referralReasons,
      premium,
      premiumManualKeys,
      rating: options?.rating ?? policy.car.rating,
    },
  };
}
