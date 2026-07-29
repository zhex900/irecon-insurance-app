import {
  POLICY_MESSAGE_NOTE_TYPE_ID,
  type Policy,
  type PremiumBreakdown,
} from "~/lib/db/types";
export { POLICY_MESSAGE_NOTE_TYPE_ID };
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import type { z } from "zod";
import {
  isTerminalStatus,
  POLICY_STATUS,
  type carPolicyDraftSchema,
} from "~/lib/zod/policy-car";
import {
  flatCustomWordings,
  normalizeCustomWordings,
} from "~/lib/custom-wordings";
import {
  calculatePremiumForPolicy,
  createMessageNote,
  mergeReferralNotes,
} from "~/lib/services/price/premium.service";
import {
  createPolicyDraft,
  getPolicy,
  savePolicy,
} from "~/lib/services/policy/data.service";
import { getBrokerSession } from "~/lib/services/broker-session";
import {
  formatTakenStatusBlockMessage,
  getTakenStatusErrors,
} from "~/lib/policy-taken-status";

export { isTerminalStatus };
export {
  formatTakenStatusBlockMessage,
  getTakenStatusErrors,
} from "~/lib/policy-taken-status";

type DraftValues = z.infer<typeof carPolicyDraftSchema>;

export class PolicySaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicySaveError";
  }
}

export async function savePolicyDraft(policyId: number, values: DraftValues) {
  const existing = await getPolicy(policyId);
  if (!existing) throw new Error("Policy not found");
  if (isTerminalStatus(existing.policyStatusId)) {
    throw new PolicySaveError("This policy status cannot be changed.");
  }
  // Preserve submitted policies — blur-save must not re-draft them.
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
    { draft: existing.isDraft, premium: premiumOverride },
  );
  return savePolicy({ ...policy, isDraft: existing.isDraft });
}

export async function upsertPolicyFromForm(
  policyId: number,
  values: CarPolicyFormValues & {
    premium?: NonNullable<Policy["car"]["premium"]> | Record<string, number>;
  },
) {
  const existing = await getPolicy(policyId);
  if (!existing) throw new Error("Policy not found");
  if (isTerminalStatus(existing.policyStatusId)) {
    throw new PolicySaveError("This policy status cannot be changed.");
  }

  const {
    premium: calculatedPremium,
    rating,
    referralReasons,
  } = await calculatePremiumForPolicy(values);

  // Prefer broker manual edits when provided; otherwise use the calculator.
  const premium: PremiumBreakdown =
    values.premium && typeof values.premium === "object"
      ? {
          ...calculatedPremium,
          ...(values.premium as Partial<PremiumBreakdown>),
        }
      : calculatedPremium;

  if (
    existing.policyStatusId !== POLICY_STATUS.Taken &&
    values.policyStatusId === POLICY_STATUS.Taken
  ) {
    const takenErrors = getTakenStatusErrors(values, premium);
    if (takenErrors.length > 0) {
      throw new PolicySaveError(formatTakenStatusBlockMessage(takenErrors));
    }
  }

  const broker = getBrokerSession();
  const policy = applyFormValues(existing, values, {
    draft: false,
    premium,
    rating,
    referralReasons,
    notes: mergeReferralNotes(
      existing.notes,
      policyId,
      referralReasons,
      broker.email,
    ),
  });

  return savePolicy({ ...policy, isDraft: false });
}

export async function applyPremiumCalculation(
  policyId: number,
  values: CarPolicyFormValues,
) {
  const existing = await getPolicy(policyId);
  if (!existing) throw new Error("Policy not found");
  const { premium, rating, referralReasons } =
    await calculatePremiumForPolicy(values);
  const broker = getBrokerSession();

  // Preserve submitted state — recalculate must not flip isDraft back to true.
  const policy = applyFormValues(existing, values, {
    draft: existing.isDraft,
    premium,
    rating,
    referralReasons,
    notes: mergeReferralNotes(
      existing.notes,
      policyId,
      referralReasons,
      broker.email,
    ),
  });

  return savePolicy(policy);
}

export async function addPolicyNote(
  policyId: number,
  description: string,
  createdBy: string,
) {
  const text = description.trim();
  if (!text) {
    throw new PolicySaveError("Note cannot be empty.");
  }
  const existing = await getPolicy(policyId);
  if (!existing) throw new Error("Policy not found");
  const note = createMessageNote(policyId, text, createdBy);
  return savePolicy({
    ...existing,
    notes: [...(existing.notes ?? []), note],
  });
}

export async function updatePolicyNote(
  policyId: number,
  policyNoteId: number,
  description: string,
) {
  const text = description.trim();
  if (!text) {
    throw new PolicySaveError("Note cannot be empty.");
  }
  const existing = await getPolicy(policyId);
  if (!existing) throw new Error("Policy not found");
  const notes = existing.notes ?? [];
  const index = notes.findIndex((note) => note.policyNoteId === policyNoteId);
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

export async function clonePolicy(sourcePolicyId: number) {
  const source = await getPolicy(sourcePolicyId);
  if (!source) throw new Error("Policy not found");

  // Copy risk fields only — never carry terminal/pricing progress into the draft.
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

  return createPolicyDraft(source.clientId, {
    policyCategoryId: source.policyCategoryId,
    policyStatusId: POLICY_STATUS.Pending,
    postcode: source.postcode,
    stateId: source.stateId,
    dateEffective: source.dateEffective,
    dateStart: source.dateStart,
    dateEnd: source.dateEnd,
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
  },
): Policy {
  const customWordings = values.customWordings
    ? normalizeCustomWordings(values.customWordings)
    : (existing.car.customWordings ?? []);

  return {
    ...existing,
    policyCategoryId: values.policyCategoryId ?? existing.policyCategoryId,
    policyStatusId: values.policyStatusId ?? existing.policyStatusId,
    policyNumber:
      values.policyCategoryId === 2 && values.policyNumber
        ? values.policyNumber
        : existing.policyNumber,
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
      // Premium lines come from the calculator / existing premium — not risk values.
      contractWorksExistingStructurePremium:
        extras.premium?.contractWorksExistingStructurePremium ??
        existing.car.contractWorksExistingStructurePremium,
      contractWorksDisplayHomesPremium:
        extras.premium?.contractWorksDisplayHomesPremium ??
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
      rating: extras.rating ?? existing.car.rating,
    },
  };
}
