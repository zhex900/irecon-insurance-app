import type {
  policy,
  policyCar,
  policyCarAdjustment,
  policyCarSelectedWording,
  policyDocument,
  policyNote,
} from "~/lib/db/schema";
import type {
  CarAdjustmentRecord,
  CarExcesses,
  CarSubLimits,
  Policy,
  PolicyDocument,
  PolicyNote,
  PremiumBreakdown,
  RatingSnapshot,
} from "~/lib/db/types";
import {
  type CustomWordingItem,
  flatCustomWordings,
  normalizeCustomWordings,
} from "~/lib/policies/custom-wordings";
import { normalizeExcesses } from "~/lib/policies/excesses";

type PolicyRow = typeof policy.$inferSelect;
type PolicyCarRow = typeof policyCar.$inferSelect;
type AdjustmentRow = typeof policyCarAdjustment.$inferSelect;
type PolicyDocumentRow = typeof policyDocument.$inferSelect;
type PolicyNoteRow = typeof policyNote.$inferSelect;
type PolicyCarSelectedWordingRow = typeof policyCarSelectedWording.$inferSelect;

/** Loader / list shape — excludes inline PDF blobs and merge snapshots. */
export type PolicyDocumentMetadataRow = Pick<
  PolicyDocumentRow,
  | "documentId"
  | "policyId"
  | "name"
  | "filename"
  | "generationKey"
  | "templateKey"
  | "libraryDocumentId"
  | "generatedWhen"
  | "generatedBy"
  | "documentTypeCode"
  | "r2Key"
>;

export type PolicyChildRows = {
  documents?: PolicyDocumentMetadataRow[];
  notes?: PolicyNoteRow[];
  selectedWordings?: PolicyCarSelectedWordingRow[];
};

function num(value: string | number | null | undefined, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isoDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function isoDateTime(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  return value.toISOString();
}

function hasPremium(car: PolicyCarRow): boolean {
  return (
    car.originalTotalPremium != null || car.contractWorksBasePremium != null
  );
}

function premiumFromRow(car: PolicyCarRow): PremiumBreakdown | undefined {
  if (!hasPremium(car)) return undefined;
  return {
    contractWorksCalculatedBasePremium: num(
      car.contractWorksCalculatedBasePremium,
    ),
    contractWorksBasePremium: num(car.contractWorksBasePremium),
    contractWorksPlantPremium: num(car.contractWorksPlantPremium),
    contractWorksPlantESL: num(car.contractWorksPlantEsl),
    contractWorksESL: num(car.contractWorksEsl),
    contractWorksGST: num(car.contractWorksGst),
    contractWorksStampDuty: num(car.contractWorksStampDuty),
    contractWorksTerrorismPremium: num(car.contractWorksTerrorismPremium),
    contractWorksPlantTerrorismPremium: num(
      car.contractWorksPlantTerrorismPremium,
    ),
    contractWorksDisplayHomesPremium: num(car.contractWorksDisplayHomesPremium),
    contractWorksExistingStructurePremium: num(
      car.contractWorksExistingStructurePremium,
    ),
    contractWorksTotalPremium: num(car.contractWorksTotalPremium),
    liabilityCalculatedBasePremium: num(car.liabilityCalculatedBasePremium),
    liabilityBasePremium: num(car.liabilityBasePremium),
    liabilityESL: num(car.liabilityEsl),
    liabilityGST: num(car.liabilityGst),
    liabilityStampDuty: num(car.liabilityStampDuty),
    liabilityTotalPremium: num(car.liabilityTotalPremium),
    combinedBrokerFee: num(car.combinedBrokerFee),
    originalTotalPremium: num(car.originalTotalPremium),
  };
}

function normalizeRatingSnapshot(
  rating: RatingSnapshot | Record<string, unknown>,
  fallbackTier = "",
  fallbackTerrorExists = false,
): RatingSnapshot {
  const r = rating as Partial<RatingSnapshot>;
  return {
    priceId: num(r.priceId),
    stampDutyId: num(r.stampDutyId),
    eslId: num(r.eslId),
    plantRate: num(r.plantRate),
    eslRate: num(r.eslRate),
    plantEslRate: num(r.plantEslRate),
    contractWorksStampDutyRate: num(r.contractWorksStampDutyRate),
    liabilityStampDutyRate: num(r.liabilityStampDutyRate),
    contractWorksAppliedRate: num(r.contractWorksAppliedRate),
    liabilityAppliedRate: num(r.liabilityAppliedRate),
    contractWorksMinPremium: num(r.contractWorksMinPremium),
    liabilityMinPremium: num(r.liabilityMinPremium),
    plantValueMin: num(r.plantValueMin),
    plantValueMax: num(r.plantValueMax),
    terrorismRate: num(r.terrorismRate),
    terrorismTier:
      typeof r.terrorismTier === "string" && r.terrorismTier
        ? r.terrorismTier
        : fallbackTier,
    isTerrorismRateExist: Boolean(
      r.isTerrorismRateExist ?? fallbackTerrorExists,
    ),
  };
}

function ratingFromRow(car: PolicyCarRow): RatingSnapshot | undefined {
  if (car.priceId == null && car.plantRate == null) return undefined;
  return normalizeRatingSnapshot(
    {
      priceId: car.priceId ?? 0,
      stampDutyId: car.priceStampDutyId ?? 0,
      eslId: car.priceEslId ?? 0,
      plantRate: car.plantRate,
      eslRate: car.eslRate,
      plantEslRate: car.plantEslRate,
      contractWorksStampDutyRate: car.contractWorksStampDutyRate,
      liabilityStampDutyRate: car.liabilityStampDutyRate,
      contractWorksAppliedRate: car.contractWorksAppliedRate,
      liabilityAppliedRate: car.liabilityAppliedRate,
      contractWorksMinPremium: car.contractWorksMinPremium,
      liabilityMinPremium: car.liabilityMinPremium,
      plantValueMin: car.plantValueMin,
      plantValueMax: car.plantValueMax,
      terrorismRate: car.terrorismRate,
      terrorismTier: car.terrorismTier ?? "",
      isTerrorismRateExist: car.isTerrorismRateExist,
    },
    car.terrorismTier ?? "",
    Boolean(car.isTerrorismRateExist),
  );
}

function customWordingsFromRow(wordings: unknown[]): CustomWordingItem[] {
  const items = (wordings ?? []).map((entry, index) => {
    const item = entry as {
      id?: string;
      subject?: string;
      content?: string;
    };
    return {
      id: item.id ?? `w-${index}`,
      subject: item.subject ?? "",
      content: item.content ?? "",
    };
  });
  return normalizeCustomWordings(items);
}

function documentRowToDomain(row: PolicyDocumentMetadataRow): PolicyDocument {
  return {
    documentId: row.documentId,
    policyId: row.policyId,
    name: row.name,
    filename: row.filename,
    generationKey: row.generationKey,
    content: "",
    templateKey: row.templateKey ?? undefined,
    libraryDocumentId: row.libraryDocumentId ?? undefined,
    generatedWhen: isoDateTime(row.generatedWhen),
    generatedBy: row.generatedBy,
    documentTypeCode: row.documentTypeCode ?? undefined,
    r2Key: row.r2Key ?? undefined,
  };
}

function noteRowToDomain(row: PolicyNoteRow): PolicyNote {
  return {
    noteId: row.noteId,
    policyId: row.policyId,
    policyNoteTypeId: row.policyNoteTypeId,
    description: row.description,
    createdWhen: isoDateTime(row.createdWhen),
    createdBy: row.createdBy,
  };
}

export function rowsToPolicy(
  p: PolicyRow,
  car: PolicyCarRow,
  adjustment?: AdjustmentRow | null,
  children: PolicyChildRows = {},
): Policy {
  const premium = premiumFromRow(car);
  const rating = ratingFromRow(car);
  const adj = adjustment
    ? ((adjustment.appSnapshot as CarAdjustmentRecord | null) ?? undefined)
    : undefined;
  const customWordings = customWordingsFromRow(car.wordings ?? []);
  const selectedWordingIds = (children.selectedWordings ?? []).map(
    (row) => row.carWordingId,
  );
  const premiumManualKeys = Array.isArray(car.premiumManualKeys)
    ? car.premiumManualKeys.filter((key) => typeof key === "string")
    : undefined;

  return {
    policyId: p.policyId,
    clientId: p.clientId,
    policyNumber: p.policyNumber,
    policyCategoryId: p.policyCategoryId,
    policyStatusId: p.policyStatusId,
    postcode: p.postcode,
    stateId: p.stateId,
    dateEffective: isoDate(p.dateStart),
    dateStart: isoDate(p.dateStart),
    dateEnd: isoDate(p.dateEnd),
    createdWhen: isoDateTime(p.createdWhen),
    createdBy: p.createdBy,
    insurerCode: p.insurerCode,
    isDraft: p.isDraft,
    notes: (children.notes ?? []).map(noteRowToDomain),
    documents: (children.documents ?? []).map(documentRowToDomain),
    car: {
      coverTypeId: car.coverTypeId,
      annualCoverTypeId: car.annualCoverTypeId,
      siteAddress: car.siteAddress,
      insuredName: car.insuredName,
      estimatedTurnover: num(car.estimatedTurnover),
      businessActivities: car.businessActivities,
      insuredContracts: car.insuredContracts,
      geographicalScopes: car.geographicalScopes,
      plantEquipment: num(car.plantEquipment),
      existingStructure: num(car.existingStructure),
      displayHomes: num(car.displayHomes),
      claimsCountLast3Years: car.claimsCountLast3Years,
      anyClaimsExceed20k: car.anyClaimsExceed20k,
      declarationConfirmed: car.declarationConfirmed,
      contractWorksSumInsured: num(car.contractWorksSumInsured),
      liabilityLimitBand: car.liabilityLimitBand,
      hasExistingContractWorksCover: car.hasExistingContractWorksCover,
      currentInsurer: car.currentInsurer,
      maximumConstructionPeriod: car.maximumConstructionPeriod,
      maximumMaintenancePeriod: car.maximumMaintenancePeriod,
      contractWorksExistingStructurePremium: num(
        car.contractWorksExistingStructurePremium,
      ),
      contractWorksDisplayHomesPremium: num(
        car.contractWorksDisplayHomesPremium,
      ),
      subLimits: (car.subLimits ?? {}) as CarSubLimits,
      excesses: normalizeExcesses((car.excesses ?? {}) as CarExcesses, {
        contractWorksSumInsured: num(car.contractWorksSumInsured),
        liabilityLimitBand: car.liabilityLimitBand,
      }),
      excludedContracts1: car.excludedContracts1 ?? "",
      excludedContracts2: car.excludedContracts2 ?? "",
      excludedContracts3: car.excludedContracts3 ?? "",
      selectedWordingIds,
      customWordings,
      ...flatCustomWordings(customWordings),
      referralReasons: car.referralReasons ?? [],
      premium,
      premiumManualKeys,
      rating,
      adjusted: Boolean(adjustment),
      adjustment: adj,
    },
  };
}

function dec(value: number | undefined | null): string | null {
  if (value == null) return null;
  return String(value);
}

function documentToRow(
  doc: PolicyDocument,
): typeof policyDocument.$inferInsert {
  const content = doc.templateKey ? "" : (doc.content ?? "").slice(0, 2_000);
  return {
    documentId: doc.documentId,
    policyId: doc.policyId,
    name: doc.name,
    filename: doc.filename,
    generationKey: doc.generationKey,
    content,
    templateKey: doc.templateKey ?? null,
    libraryDocumentId: doc.libraryDocumentId ?? null,
    generatedWhen: new Date(doc.generatedWhen),
    generatedBy: doc.generatedBy,
    documentTypeCode: doc.documentTypeCode ?? null,
    r2Key: doc.r2Key ?? null,
  };
}

function noteToRow(note: PolicyNote): typeof policyNote.$inferInsert {
  return {
    noteId: note.noteId,
    policyId: note.policyId,
    policyNoteTypeId: note.policyNoteTypeId,
    description: note.description,
    createdWhen: new Date(note.createdWhen),
    createdBy: note.createdBy,
  };
}

export function policyToRows(policyDoc: Policy): {
  policyValues: typeof policy.$inferInsert;
  carValues: typeof policyCar.$inferInsert;
  adjustmentValues: typeof policyCarAdjustment.$inferInsert | null;
  documentValues: Array<typeof policyDocument.$inferInsert>;
  noteValues: Array<typeof policyNote.$inferInsert>;
  selectedWordingIds: number[];
} {
  const premium = policyDoc.car.premium;
  const rating = policyDoc.car.rating;
  const customWordings = normalizeCustomWordings(policyDoc.car.customWordings, {
    subject: policyDoc.car.customWordingSubject,
    content: policyDoc.car.customWordingContent,
    subject2: policyDoc.car.customWordingSubject2,
    content2: policyDoc.car.customWordingContent2,
  });

  const wordings: unknown[] = customWordings.map((item) => ({
    id: item.id,
    subject: item.subject,
    content: item.content,
  }));

  const policyValues: typeof policy.$inferInsert = {
    policyId: policyDoc.policyId,
    clientId: policyDoc.clientId,
    policyTypeId: 1,
    policyStatusId: policyDoc.policyStatusId,
    postcode: policyDoc.postcode,
    stateId: policyDoc.stateId,
    policyCategoryId: policyDoc.policyCategoryId,
    policyNumber: policyDoc.policyNumber,
    dateStart: new Date(`${policyDoc.dateStart}T00:00:00.000Z`),
    dateEnd: new Date(`${policyDoc.dateEnd}T00:00:00.000Z`),
    insurerCode: policyDoc.insurerCode,
    isDraft: Boolean(policyDoc.isDraft ?? !premium),
    createdWhen: new Date(policyDoc.createdWhen),
    createdBy: policyDoc.createdBy,
    updatedWhen: new Date(),
  };

  const carValues: typeof policyCar.$inferInsert = {
    policyId: policyDoc.policyId,
    coverTypeId: policyDoc.car.coverTypeId,
    annualCoverTypeId:
      policyDoc.car.coverTypeId === 1
        ? (policyDoc.car.annualCoverTypeId ?? null)
        : null,
    siteAddress: policyDoc.car.siteAddress,
    insuredName: policyDoc.car.insuredName,
    estimatedTurnover: String(policyDoc.car.estimatedTurnover ?? 0),
    businessActivities: policyDoc.car.businessActivities,
    insuredContracts: policyDoc.car.insuredContracts,
    geographicalScopes: policyDoc.car.geographicalScopes,
    plantEquipment: String(policyDoc.car.plantEquipment ?? 0),
    existingStructure: String(policyDoc.car.existingStructure ?? 0),
    displayHomes: String(policyDoc.car.displayHomes ?? 0),
    claimsCountLast3Years: policyDoc.car.claimsCountLast3Years,
    anyClaimsExceed20k: policyDoc.car.anyClaimsExceed20k,
    declarationConfirmed: policyDoc.car.declarationConfirmed,
    contractWorksSumInsured: String(policyDoc.car.contractWorksSumInsured ?? 0),
    liabilityLimitBand: policyDoc.car.liabilityLimitBand,
    hasExistingContractWorksCover: policyDoc.car.hasExistingContractWorksCover,
    currentInsurer: policyDoc.car.currentInsurer,
    maximumConstructionPeriod: policyDoc.car.maximumConstructionPeriod,
    maximumMaintenancePeriod: policyDoc.car.maximumMaintenancePeriod,
    contractWorksCalculatedBasePremium: dec(
      premium?.contractWorksCalculatedBasePremium,
    ),
    contractWorksBasePremium: dec(premium?.contractWorksBasePremium),
    contractWorksExistingStructurePremium: dec(
      premium?.contractWorksExistingStructurePremium ??
        policyDoc.car.contractWorksExistingStructurePremium,
    ),
    contractWorksPlantPremium: dec(premium?.contractWorksPlantPremium),
    contractWorksPlantEsl: dec(premium?.contractWorksPlantESL),
    contractWorksEsl: dec(premium?.contractWorksESL),
    contractWorksGst: dec(premium?.contractWorksGST),
    contractWorksStampDuty: dec(premium?.contractWorksStampDuty),
    contractWorksTerrorismPremium: dec(premium?.contractWorksTerrorismPremium),
    contractWorksPlantTerrorismPremium: dec(
      premium?.contractWorksPlantTerrorismPremium,
    ),
    contractWorksDisplayHomesPremium: dec(
      premium?.contractWorksDisplayHomesPremium ??
        policyDoc.car.contractWorksDisplayHomesPremium,
    ),
    contractWorksTotalPremium: dec(premium?.contractWorksTotalPremium),
    liabilityCalculatedBasePremium: dec(
      premium?.liabilityCalculatedBasePremium,
    ),
    liabilityBasePremium: dec(premium?.liabilityBasePremium),
    liabilityEsl: dec(premium?.liabilityESL),
    liabilityGst: dec(premium?.liabilityGST),
    liabilityStampDuty: dec(premium?.liabilityStampDuty),
    liabilityTotalPremium: dec(premium?.liabilityTotalPremium),
    originalTotalPremium: dec(premium?.originalTotalPremium),
    contractWorksAppliedRate: dec(rating?.contractWorksAppliedRate),
    liabilityAppliedRate: dec(rating?.liabilityAppliedRate),
    priceId: rating?.priceId,
    priceStampDutyId: rating?.stampDutyId,
    priceEslId: rating?.eslId,
    plantRate: dec(rating?.plantRate),
    eslRate: dec(rating?.eslRate),
    plantEslRate: dec(rating?.plantEslRate),
    contractWorksStampDutyRate: dec(rating?.contractWorksStampDutyRate),
    liabilityStampDutyRate: dec(rating?.liabilityStampDutyRate),
    contractWorksMinPremium: dec(rating?.contractWorksMinPremium),
    liabilityMinPremium: dec(rating?.liabilityMinPremium),
    plantValueMin: dec(rating?.plantValueMin),
    plantValueMax: dec(rating?.plantValueMax),
    terrorismRate: dec(rating?.terrorismRate),
    excludedContracts1: policyDoc.car.excludedContracts1,
    excludedContracts2: policyDoc.car.excludedContracts2,
    excludedContracts3: policyDoc.car.excludedContracts3,
    combinedBrokerFee: dec(premium?.combinedBrokerFee),
    terrorismTier: rating?.terrorismTier ?? "",
    isTerrorismRateExist: Boolean(rating?.isTerrorismRateExist),
    premiumManualKeys: policyDoc.car.premiumManualKeys ?? [],
    referralReasons: policyDoc.car.referralReasons ?? [],
    excesses: policyDoc.car.excesses ?? {},
    subLimits: policyDoc.car.subLimits ?? {},
    wordings,
  };

  let adjustmentValues: typeof policyCarAdjustment.$inferInsert | null = null;
  if (policyDoc.car.adjustment) {
    const a = policyDoc.car.adjustment;
    adjustmentValues = {
      policyId: policyDoc.policyId,
      adjustedTurnover: String(a.adjustedTurnover ?? 0),
      stampDutyExempt: Boolean(a.stampDutyExempt),
      deltaContractWorksBasePremium: String(
        a.breakdown?.delta?.section1?.trueBasePremium ??
          a.adjustedContractWorksBasePremium -
            (premium?.contractWorksBasePremium ?? 0),
      ),
      deltaTotalPremium: String(
        a.adjustedTotalPremium - (premium?.originalTotalPremium ?? 0),
      ),
      appSnapshot: a as Record<string, unknown>,
      createdWhen: new Date(a.adjustedDate || Date.now()),
      createdBy: policyDoc.createdBy,
      updatedWhen: new Date(),
      updatedBy: policyDoc.createdBy,
    };
  }

  return {
    policyValues,
    carValues,
    adjustmentValues,
    documentValues: (policyDoc.documents ?? []).map(documentToRow),
    noteValues: (policyDoc.notes ?? []).map(noteToRow),
    selectedWordingIds: policyDoc.car.selectedWordingIds ?? [],
  };
}
