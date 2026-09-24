import { addMonths } from "date-fns";
import type { z } from "zod";

import {
  isPolicyNumberConflict,
  isSeriesNumberConflict,
} from "~/lib/db/postgres-unique-violation";
import {
  type Policy,
  POLICY_MESSAGE_NOTE_TYPE_ID,
  type PremiumBreakdown,
} from "~/lib/db/types";
import { NotFoundError, ValidationError } from "~/lib/errors";
import { deriveMaximumConstructionPeriod } from "~/lib/policies/construction-period";
import {
  flatCustomWordings,
  normalizeCustomWordings,
} from "~/lib/policies/custom-wordings";
import {
  SERIES_NUMBER_TAKEN_MESSAGE,
  validateSeriesNumberInput,
} from "~/lib/policies/policy-number";
import { derivePolicyEndDate } from "~/lib/policies/policy-period";
import {
  effectivePolicyCategoryId,
  isRenewalPolicyCategory,
  RENEWAL_SERIES_IMMUTABLE_MESSAGE,
  resolveSeriesNumberFromForm,
} from "~/lib/policies/policy-series";
import {
  formatTakenStatusBlockMessage,
  getTakenStatusErrors,
} from "~/lib/policies/taken-status";
import {
  buildReferralReasons,
  liabilityLimitLabel,
} from "~/lib/pricing/referral-reasons";
import { toIsoDate } from "~/lib/search/date-range-filter";
import {
  createPolicyDraft,
  getPolicy,
  isSeriesNumberTaken,
  savePolicy,
} from "~/lib/services/policy/data.service";
import {
  calculatePremiumForPolicy,
  createMessageNote,
  mergeReferralNotes,
} from "~/lib/services/price/premium.service";
import type {
  carPolicyDraftSchema,
  CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import { isTerminalStatus, POLICY_STATUS } from "~/lib/zod/policy-car";

export { POLICY_MESSAGE_NOTE_TYPE_ID };

export { isTerminalStatus };
export {
  formatTakenStatusBlockMessage,
  getTakenStatusErrors,
} from "~/lib/policies/taken-status";

type DraftValues = z.infer<typeof carPolicyDraftSchema>;

export class PolicySaveError extends ValidationError {}

const RENEWAL_DRAFT_MAX_ATTEMPTS = 25;

/**
 * Create a renewal draft: same series, new internal term number, chain link.
 */
async function createRenewalDraft(
  source: Policy,
  createdBy: string,
  partial: Omit<
    Partial<Policy>,
    "policyNumber" | "policySeriesId" | "seriesNumber"
  >,
): Promise<Policy> {
  for (let attempt = 0; attempt < RENEWAL_DRAFT_MAX_ATTEMPTS; attempt++) {
    try {
      return await createPolicyDraft(
        source.clientId,
        {
          ...partial,
          policySeriesId: source.policySeriesId,
          seriesNumber: source.seriesNumber,
          copiedFromPolicyId: source.policyId,
        },
        createdBy,
      );
    } catch (error) {
      if (!isPolicyNumberConflict(error) && !isSeriesNumberConflict(error)) {
        throw error;
      }
    }
  }
  throw new PolicySaveError("Could not allocate a unique renewal term.");
}

/**
 * Validate shape + uniqueness when a save changes the client-facing series number.
 */
export async function assertSeriesNumberAvailable(
  next: Policy,
  existing: Policy,
) {
  if (
    isRenewalPolicyCategory(next.policyCategoryId) &&
    next.seriesNumber !== existing.seriesNumber
  ) {
    throw new PolicySaveError(RENEWAL_SERIES_IMMUTABLE_MESSAGE);
  }
  if (next.seriesNumber === existing.seriesNumber) return;
  const validated = validateSeriesNumberInput(next.seriesNumber);
  if (!validated.ok) throw new PolicySaveError(validated.message);
  if (
    await isSeriesNumberTaken(validated.seriesNumber, existing.policySeriesId)
  ) {
    throw new PolicySaveError(SERIES_NUMBER_TAKEN_MESSAGE);
  }
}

export async function savePolicyDraft(policyId: string, values: DraftValues) {
  const existing = await getPolicy(policyId);
  if (!existing) throw new NotFoundError("Policy not found");
  if (isTerminalStatus(existing.policyStatusId)) {
    throw new PolicySaveError("This policy status cannot be changed.");
  }
  const keepSubmitted = !existing.isDraft;
  const premiumOverride =
    values.premium && typeof values.premium === "object"
      ? ({
          ...existing.car.premium,
          ...values.premium,
        } as Policy["car"]["premium"])
      : undefined;
  const policy = applyFormValues(
    existing,
    {
      ...values,
      policyStatusId: keepSubmitted
        ? existing.policyStatusId
        : POLICY_STATUS.Pending,
    },
    {
      draft: existing.isDraft ?? true,
      premium: premiumOverride,
      premiumManualKeys: values.premiumManualKeys,
    },
  );
  await assertSeriesNumberAvailable(policy, existing);
  return savePolicy({ ...policy, isDraft: existing.isDraft ?? true });
}

export async function upsertPolicyFromForm(
  policyId: string,
  values: CarPolicyFormValues & {
    premium?: NonNullable<Policy["car"]["premium"]> | Record<string, number>;
  },
  createdBy: string,
) {
  const { monitorCriticalOperation } =
    await import("~/lib/performance/internal-monitoring.server");

  return monitorCriticalOperation("policySubmit", async () => {
    const existing = await getPolicy(policyId);
    if (!existing) throw new NotFoundError("Policy not found");
    if (isTerminalStatus(existing.policyStatusId)) {
      throw new PolicySaveError("This policy status cannot be changed.");
    }

    const { premium: calculatedPremium, rating } =
      await calculatePremiumForPolicy(values);

    const premium: PremiumBreakdown =
      values.premium && typeof values.premium === "object"
        ? {
            ...calculatedPremium,
            ...(values.premium as Partial<PremiumBreakdown>),
          }
        : calculatedPremium;

    const referralReasons = buildReferralReasons(
      values,
      rating,
      liabilityLimitLabel(Number(values.liabilityLimitBand)),
    );

    if (
      existing.policyStatusId !== POLICY_STATUS.Taken &&
      values.policyStatusId === POLICY_STATUS.Taken
    ) {
      const takenErrors = getTakenStatusErrors(values, premium);
      if (takenErrors.length > 0) {
        throw new PolicySaveError(formatTakenStatusBlockMessage(takenErrors));
      }
    }

    const policy = applyFormValues(existing, values, {
      draft: false,
      premium,
      rating,
      referralReasons,
      notes: mergeReferralNotes(
        existing.notes,
        policyId,
        referralReasons,
        createdBy,
      ),
    });

    await assertSeriesNumberAvailable(policy, existing);
    return savePolicy({ ...policy, isDraft: false }, { actor: createdBy });
  });
}

export async function applyPremiumCalculation(
  policyId: string,
  values: CarPolicyFormValues,
  createdBy: string,
) {
  const existing = await getPolicy(policyId);
  if (!existing) throw new NotFoundError("Policy not found");
  const { premium, rating, referralReasons } =
    await calculatePremiumForPolicy(values);

  const policy = applyFormValues(existing, values, {
    draft: existing.isDraft ?? true,
    premium,
    rating,
    referralReasons,
    premiumManualKeys: [],
    notes: mergeReferralNotes(
      existing.notes,
      policyId,
      referralReasons,
      createdBy,
    ),
  });

  await assertSeriesNumberAvailable(policy, existing);
  return savePolicy(policy);
}

export async function addPolicyNote(
  policyId: string,
  description: string,
  createdBy: string,
) {
  const text = description.trim();
  if (!text) {
    throw new PolicySaveError("Note cannot be empty.");
  }
  const existing = await getPolicy(policyId);
  if (!existing) throw new NotFoundError("Policy not found");
  const note = createMessageNote(policyId, text, createdBy);
  return savePolicy({
    ...existing,
    notes: [...(existing.notes ?? []), note],
  });
}

export async function updatePolicyNote(
  policyId: string,
  noteId: string,
  description: string,
) {
  const text = description.trim();
  if (!text) {
    throw new PolicySaveError("Note cannot be empty.");
  }
  const existing = await getPolicy(policyId);
  if (!existing) throw new NotFoundError("Policy not found");
  const notes = existing.notes ?? [];
  const index = notes.findIndex((note) => note.noteId === noteId);
  if (index < 0) {
    throw new PolicySaveError("Note not found.");
  }
  const current = notes[index]!;
  if (current.policyNoteTypeId !== POLICY_MESSAGE_NOTE_TYPE_ID) {
    throw new PolicySaveError("Only broker notes can be edited.");
  }
  const next = [...notes];
  next[index] = { ...current, description: text };
  return savePolicy({
    ...existing,
    notes: next,
  });
}

export async function clonePolicy(sourcePolicyId: string, createdBy: string) {
  const source = await getPolicy(sourcePolicyId);
  if (!source) throw new NotFoundError("Policy not found");

  const car: Policy["car"] = {
    coverTypeId: source.car.coverTypeId,
    annualCoverTypeId: source.car.annualCoverTypeId ?? null,
    siteAddress: source.car.siteAddress,
    insuredName: source.car.insuredName,
    estimatedTurnover: source.car.estimatedTurnover,
    businessActivities: source.car.businessActivities,
    insuredContracts: source.car.insuredContracts,
    geographicalScopes: source.car.geographicalScopes,
    plantEquipment: source.car.plantEquipment,
    existingStructure: source.car.existingStructure,
    displayHomes: source.car.displayHomes,
    claimsCountLast3Years: source.car.claimsCountLast3Years,
    anyClaimsExceed20k: source.car.anyClaimsExceed20k,
    declarationConfirmed: false,
    contractWorksSumInsured: source.car.contractWorksSumInsured,
    liabilityLimitBand: source.car.liabilityLimitBand,
    hasExistingContractWorksCover: source.car.hasExistingContractWorksCover,
    currentInsurer: source.car.currentInsurer,
    maximumConstructionPeriod: source.car.maximumConstructionPeriod,
    maximumMaintenancePeriod: source.car.maximumMaintenancePeriod,
    contractWorksExistingStructurePremium:
      source.car.contractWorksExistingStructurePremium,
    contractWorksDisplayHomesPremium:
      source.car.contractWorksDisplayHomesPremium,
    subLimits: { ...source.car.subLimits },
    excesses: { ...source.car.excesses },
    excludedContracts1: source.car.excludedContracts1,
    excludedContracts2: source.car.excludedContracts2,
    excludedContracts3: source.car.excludedContracts3,
    selectedWordingIds: [...source.car.selectedWordingIds],
    customWordings: [...(source.car.customWordings ?? [])],
    ...flatCustomWordings(source.car.customWordings ?? []),
    referralReasons: [],
  };

  return createPolicyDraft(
    source.clientId,
    {
      policyCategoryId: source.policyCategoryId,
      policyStatusId: POLICY_STATUS.Pending,
      postcode: source.postcode,
      stateId: source.stateId,
      dateEffective: source.dateEffective,
      dateStart: source.dateStart,
      dateEnd: source.dateEnd,
      insurerCode: source.insurerCode,
      isDraft: true,
      copiedFromPolicyId: source.policyId,
      car,
    },
    createdBy,
  );
}

export async function renewPolicy(sourcePolicyId: string, createdBy: string) {
  const source = await getPolicy(sourcePolicyId);
  if (!source) throw new NotFoundError("Policy not found");

  const dateStart = addMonths(new Date(`${source.dateStart}T00:00:00`), 12);
  const maximumConstructionPeriod = deriveMaximumConstructionPeriod(
    source.car.coverTypeId,
    source.car.annualCoverTypeId,
  );
  const car: Policy["car"] = {
    coverTypeId: source.car.coverTypeId,
    annualCoverTypeId: source.car.annualCoverTypeId ?? null,
    siteAddress: source.car.siteAddress,
    insuredName: source.car.insuredName,
    estimatedTurnover: source.car.estimatedTurnover,
    businessActivities: source.car.businessActivities,
    insuredContracts: source.car.insuredContracts,
    geographicalScopes: source.car.geographicalScopes,
    plantEquipment: source.car.plantEquipment,
    existingStructure: source.car.existingStructure,
    displayHomes: source.car.displayHomes,
    claimsCountLast3Years: source.car.claimsCountLast3Years,
    anyClaimsExceed20k: source.car.anyClaimsExceed20k,
    contractWorksSumInsured: source.car.contractWorksSumInsured,
    liabilityLimitBand: source.car.liabilityLimitBand,
    hasExistingContractWorksCover: source.car.hasExistingContractWorksCover,
    currentInsurer: source.car.currentInsurer,
    maximumConstructionPeriod,
    maximumMaintenancePeriod: source.car.maximumMaintenancePeriod,
    contractWorksExistingStructurePremium:
      source.car.contractWorksExistingStructurePremium,
    contractWorksDisplayHomesPremium:
      source.car.contractWorksDisplayHomesPremium,
    subLimits: {
      ...source.car.subLimits,
      transit: "$200,000 any one loss",
    },
    excesses: { ...source.car.excesses },
    declarationConfirmed: false,
    excludedContracts1: source.car.excludedContracts1,
    excludedContracts2: source.car.excludedContracts2,
    excludedContracts3: source.car.excludedContracts3,
    selectedWordingIds: [...source.car.selectedWordingIds],
    customWordings: [...(source.car.customWordings ?? [])],
    ...flatCustomWordings(source.car.customWordings ?? []),
    referralReasons: [],
  };

  return createRenewalDraft(source, createdBy, {
    policyCategoryId: 2,
    policyStatusId: POLICY_STATUS.Pending,
    postcode: source.postcode,
    stateId: source.stateId,
    dateEffective: toIsoDate(dateStart),
    dateStart: toIsoDate(dateStart),
    dateEnd: derivePolicyEndDate(toIsoDate(dateStart)) ?? toIsoDate(dateStart),
    insurerCode: source.insurerCode,
    isDraft: true,
    car,
  });
}

function applyFormValues(
  existing: Policy,
  values: DraftValues,
  extras: {
    draft: boolean;
    premium?: Policy["car"]["premium"];
    rating?: Policy["car"]["rating"];
    referralReasons?: string[];
    notes?: Policy["notes"];
    premiumManualKeys?: string[];
  },
): Policy {
  const customWordings = values.customWordings
    ? normalizeCustomWordings(values.customWordings)
    : (existing.car.customWordings ?? []);

  return {
    ...existing,
    policyCategoryId: values.policyCategoryId ?? existing.policyCategoryId,
    policyStatusId: values.policyStatusId ?? existing.policyStatusId,
    seriesNumber: resolveSeriesNumberFromForm(
      existing.seriesNumber,
      values.policyNumber,
      {
        policyCategoryId: effectivePolicyCategoryId(
          values.policyCategoryId,
          existing.policyCategoryId,
        ),
        terminalLocked: isTerminalStatus(existing.policyStatusId),
      },
    ),
    postcode: values.postcode ?? existing.postcode,
    stateId: values.stateId ?? existing.stateId,
    dateStart: values.dateStart ?? existing.dateStart,
    dateEnd: values.dateEnd ?? existing.dateEnd,
    dateEffective: values.dateStart ?? existing.dateEffective,
    insurerCode: values.insurerCode ?? existing.insurerCode,
    isDraft: extras.draft,
    notes: extras.notes ?? existing.notes,
    car: {
      ...existing.car,
      coverTypeId: values.coverTypeId ?? existing.car.coverTypeId,
      annualCoverTypeId:
        (values.coverTypeId ?? existing.car.coverTypeId) === 1
          ? (values.annualCoverTypeId ?? existing.car.annualCoverTypeId ?? null)
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
      contractWorksExistingStructurePremium: extras.premium
        ? (extras.premium.contractWorksExistingStructurePremium ?? 0)
        : existing.car.contractWorksExistingStructurePremium,
      contractWorksDisplayHomesPremium: extras.premium
        ? (extras.premium.contractWorksDisplayHomesPremium ?? 0)
        : existing.car.contractWorksDisplayHomesPremium,
      claimsCountLast3Years:
        values.claimsCountLast3Years ?? existing.car.claimsCountLast3Years,
      anyClaimsExceed20k:
        values.anyClaimsExceed20k ?? existing.car.anyClaimsExceed20k,
      declarationConfirmed:
        values.declarationConfirmed ?? existing.car.declarationConfirmed,
      contractWorksSumInsured:
        values.contractWorksSumInsured ?? existing.car.contractWorksSumInsured,
      liabilityLimitBand:
        values.liabilityLimitBand ?? existing.car.liabilityLimitBand,
      hasExistingContractWorksCover:
        values.hasExistingContractWorksCover ??
        existing.car.hasExistingContractWorksCover,
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
            excessLegalLiabilityAdditionalNotes:
              values.excesses.excessLegalLiabilityAdditionalNotes ?? "",
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
      referralReasons: extras.referralReasons ?? existing.car.referralReasons,
      premium: extras.premium ?? existing.car.premium,
      premiumManualKeys:
        extras.premiumManualKeys !== undefined
          ? extras.premiumManualKeys
          : (values.premiumManualKeys ?? existing.car.premiumManualKeys),
      rating: extras.rating ?? existing.car.rating,
    },
  };
}
