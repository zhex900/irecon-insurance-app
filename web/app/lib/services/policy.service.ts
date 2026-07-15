import type { Quote, PremiumBreakdown } from "~/lib/db/types";
import type { CarQuoteFormValues } from "~/lib/zod/policy-car";
import type { z } from "zod";
import { CAR_STATUS, type carQuoteDraftSchema } from "~/lib/zod/policy-car";
import {
  buildReferralNotes,
  calculatePremiumForQuote,
} from "~/lib/services/pricing.service";
import { getBrokerSession, getQuote, saveQuote } from "~/lib/services/store";

type DraftValues = z.infer<typeof carQuoteDraftSchema>;

export class PolicySaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicySaveError";
  }
}

export function isTerminalStatus(carStatusId: number) {
  return carStatusId === CAR_STATUS.Taken || carStatusId === CAR_STATUS.NotTaken;
}

export function getTakenStatusErrors(
  values: Pick<CarQuoteFormValues, "existingStructure" | "plantEquipment">,
  premium: Pick<
    PremiumBreakdown,
    "section1ExistingStructure" | "section1PlantEquipment"
  >,
): string[] {
  const errors: string[] = [];
  if (
    values.existingStructure > 0 &&
    premium.section1ExistingStructure === 0
  ) {
    errors.push("Existing Structures has value however there are no premiums.");
  }
  if (values.plantEquipment > 25000 && premium.section1PlantEquipment === 0) {
    errors.push("Plant and equipment has value however there are no premiums.");
  }
  return errors;
}

export async function saveQuoteDraft(policyId: number, values: DraftValues) {
  const existing = await getQuote(policyId);
  if (!existing) throw new Error("Quote not found");
  if (isTerminalStatus(existing.carStatusId)) {
    throw new PolicySaveError("This policy status cannot be changed.");
  }
  // Drafts stay Pending — status changes only on full save
  const quote = applyFormValues(
    existing,
    { ...values, carStatusId: CAR_STATUS.Pending },
    { draft: true },
  );
  return saveQuote({ ...quote, isDraft: true });
}

export async function upsertQuoteFromForm(
  policyId: number,
  values: CarQuoteFormValues,
) {
  const existing = await getQuote(policyId);
  if (!existing) throw new Error("Quote not found");
  if (isTerminalStatus(existing.carStatusId)) {
    throw new PolicySaveError("This policy status cannot be changed.");
  }

  const { premium, rating, referralReasons } = calculatePremiumForQuote(values);

  if (
    existing.carStatusId !== CAR_STATUS.Taken &&
    values.carStatusId === CAR_STATUS.Taken
  ) {
    const takenErrors = getTakenStatusErrors(values, premium);
    if (takenErrors.length > 0) {
      throw new PolicySaveError(
        `Unable to set status to taken. ${takenErrors.join(" ")}`,
      );
    }
  }

  const broker = getBrokerSession();
  const quote = applyFormValues(existing, values, {
    draft: false,
    premium,
    rating,
    referralReasons,
    notes: buildReferralNotes(policyId, referralReasons, broker.email),
  });

  return saveQuote({ ...quote, isDraft: false });
}

export async function applyPremiumCalculation(
  policyId: number,
  values: CarQuoteFormValues,
) {
  const existing = await getQuote(policyId);
  if (!existing) throw new Error("Quote not found");
  const { premium, rating, referralReasons } = calculatePremiumForQuote(values);
  const broker = getBrokerSession();

  const quote = applyFormValues(existing, values, {
    draft: true,
    premium,
    rating,
    referralReasons,
    notes: buildReferralNotes(policyId, referralReasons, broker.email),
  });

  return saveQuote(quote);
}

function applyFormValues(
  existing: Quote,
  values: DraftValues,
  extras: {
    draft: boolean;
    premium?: Quote["car"]["premium"];
    rating?: Quote["car"]["rating"];
    referralReasons?: string[];
    notes?: Quote["notes"];
  },
): Quote {
  return {
    ...existing,
    policyActionId: values.policyActionId ?? existing.policyActionId,
    carStatusId: values.carStatusId ?? existing.carStatusId,
    policyNumber:
      values.policyActionId === 2 && values.policyNumber
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
      section1ExistingStructure:
        values.existingStructure ?? existing.car.existingStructure,
      section1DisplayHomes: values.displayHomes ?? existing.car.displayHomes,
      numberOfClaim: values.numberOfClaim ?? existing.car.numberOfClaim,
      anyClaimsExceed20k:
        values.anyClaimsExceed20k ?? existing.car.anyClaimsExceed20k,
      confirmation: values.confirmation ?? existing.car.confirmation,
      section1Value: values.section1Value ?? existing.car.section1Value,
      section2Value: values.section2Value ?? existing.car.section2Value,
      holdCurrentContractWorks:
        values.holdCurrentContractWorks ??
        existing.car.holdCurrentContractWorks,
      currentInsurer: values.currentInsurer ?? existing.car.currentInsurer,
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
      customWordingSubject: values.customWordingEnabled
        ? values.customWordingSubject
        : undefined,
      customWordingContent: values.customWordingEnabled
        ? values.customWordingContent
        : undefined,
      referralReasons: extras.referralReasons ?? existing.car.referralReasons,
      premium: extras.premium ?? existing.car.premium,
      rating: extras.rating ?? existing.car.rating,
    },
  };
}
