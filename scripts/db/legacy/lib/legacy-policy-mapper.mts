/**
 * Map legacy MSSQL export rows → app Policy shape for policyToRows().
 */
import {
  normalizeExcesses,
  visibleExcessFields,
  type ExcessFieldKey,
} from "../../../../app/lib/policies/excesses";
import { normalizeSubLimits } from "../../../../app/lib/policies/sub-limits";
import { referenceData } from "../../../../app/lib/reference-data";
import type { Policy } from "../../../../app/lib/db/types";
import type {
  AdjustmentSectionRow,
  CarAdjustmentRecord,
  CarExcesses,
  CarSubLimits,
  PolicyNote,
} from "../../../../app/lib/db/types";
import { legacyClientUuid, legacyPolicyUuid } from "./legacy-id-map.mts";
import type {
  LegacyPolicyAdjustment,
  LegacyPolicyExcesses,
  LegacyPolicyNote,
  LegacyPolicyPremium,
  LegacyPolicyRating,
  LegacyPolicyRow,
  LegacyPolicySubLimits,
  LegacyPolicyWording,
} from "./legacy-payload.ts";

const STATE_CODE_TO_ID: Record<string, number> = {
  ACT: 1,
  NSW: 2,
  NT: 3,
  QLD: 4,
  SA: 5,
  TAS: 6,
  VIC: 7,
  WA: 8,
};

const REFERRAL_NOTE_TYPE_ID = 2;

function num(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Legacy MSSQL uses 0 for unset period columns — treat as missing. */
function positiveInt(value: unknown, fallback: number): number {
  const n = num(value, 0);
  return n > 0 ? n : fallback;
}

function defaultConstructionPeriodMonths(coverTypeId: number): number {
  return coverTypeId === 1 ? 18 : 12;
}

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function dateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value ?? "");
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function isoDateTime(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const raw = String(value ?? "");
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function stateIdForCode(code: string): number {
  return STATE_CODE_TO_ID[code.trim().toUpperCase()] ?? 2;
}

function policyCategoryId(action: string): number {
  return action.trim().toUpperCase() === "RWL" ? 2 : 1;
}

function subLimitsFromRaw(raw: Record<string, unknown>): LegacyPolicySubLimits {
  return {
    removalOfDebris: text(raw.removalOfDebris),
    expeditingExpenses: text(raw.expeditingExpenses),
    professionalFees: text(raw.professionalFees),
    mitigationExpenses: text(raw.mitigationExpenses),
    searchAndLocateCosts: text(raw.searchAndLocateCosts),
    plantHireCharges: text(raw.plantHireCharges),
    claimsPreparationCosts: text(raw.claimsPreparationCosts),
    governmentCosts: text(raw.governmentCosts),
    inflationProtection: text(raw.inflationProtection),
    employeesProperty: text(raw.employeesProperty),
    materialsInOffSiteStorage: text(raw.materialsInOffSiteStorage),
    transit: text(raw.transit),
  };
}

function excessesFromRaw(raw: Record<string, unknown>): LegacyPolicyExcesses {
  return {
    excessSection1A: text(raw.excessSection1A),
    excessSection1B: text(raw.excessSection1B),
    excessSection1C: text(raw.excessSection1C),
    excessSection1D: text(raw.excessSection1D),
    excessSection1E: text(raw.excessSection1E),
    excessSection2A: text(raw.excessSection2A),
    excessSection2B: text(raw.excessSection2B),
    excessSection2C: text(raw.excessSection2C),
    excessSection2D: text(raw.excessSection2D),
    excessSection2E: text(raw.excessSection2E),
    excessSection2F: text(raw.excessSection2F),
    excessAdditionalNotes: text(raw.excessAdditionalNotes),
  };
}

function premiumFromLegacy(
  row: LegacyPolicyRow,
): LegacyPolicyPremium | undefined {
  const originalTotal = num(row.premium?.originalTotalPremium);
  if (!originalTotal && !num(row.premium?.contractWorksBasePremium)) {
    return undefined;
  }
  const p = row.premium!;
  return {
    contractWorksCalculatedBasePremium: num(
      p.contractWorksCalculatedBasePremium,
    ),
    contractWorksBasePremium: num(p.contractWorksBasePremium),
    contractWorksPlantPremium: num(p.contractWorksPlantPremium),
    contractWorksPlantESL: num(p.contractWorksPlantESL),
    contractWorksESL: num(p.contractWorksESL),
    contractWorksGST: num(p.contractWorksGST),
    contractWorksStampDuty: num(p.contractWorksStampDuty),
    contractWorksTerrorismPremium: num(p.contractWorksTerrorismPremium),
    contractWorksPlantTerrorismPremium: num(
      p.contractWorksPlantTerrorismPremium,
    ),
    contractWorksDisplayHomesPremium: num(p.contractWorksDisplayHomesPremium),
    contractWorksExistingStructurePremium: num(
      p.contractWorksExistingStructurePremium,
    ),
    contractWorksTotalPremium: num(p.contractWorksTotalPremium),
    liabilityCalculatedBasePremium: num(p.liabilityCalculatedBasePremium),
    liabilityBasePremium: num(p.liabilityBasePremium),
    liabilityESL: num(p.liabilityESL),
    liabilityGST: num(p.liabilityGST),
    liabilityStampDuty: num(p.liabilityStampDuty),
    liabilityTotalPremium: num(p.liabilityTotalPremium),
    combinedBrokerFee: num(p.combinedBrokerFee),
    originalTotalPremium: num(p.originalTotalPremium),
  };
}

function ratingFromLegacy(
  row: LegacyPolicyRow,
): LegacyPolicyRating | undefined {
  const r = row.rating;
  if (!r || !num(r.priceId)) return undefined;
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
  };
}

function adjustmentSection(
  trueBasePremium: number,
  terrorismPremium: number,
  esl: number,
  gst: number,
  sd: number,
  totalPremium: number,
): AdjustmentSectionRow {
  return {
    trueBasePremium,
    terrorismPremium,
    esl,
    gst,
    sd,
    totalPremium,
  };
}

function buildCarAdjustmentRecord(
  row: LegacyPolicyRow,
  premium: LegacyPolicyPremium | undefined,
  adjustment: LegacyPolicyAdjustment,
): CarAdjustmentRecord {
  const originalSection1 = adjustmentSection(
    num(premium?.contractWorksBasePremium),
    num(premium?.contractWorksTerrorismPremium),
    num(premium?.contractWorksESL),
    num(premium?.contractWorksGST),
    num(premium?.contractWorksStampDuty),
    num(premium?.contractWorksTotalPremium),
  );
  const originalSection2 = adjustmentSection(
    num(premium?.liabilityBasePremium),
    0,
    num(premium?.liabilityESL),
    num(premium?.liabilityGST),
    num(premium?.liabilityStampDuty),
    num(premium?.liabilityTotalPremium),
  );
  const adjustedSection1 = adjustmentSection(
    adjustment.adjustedSection1TrueBasePremium,
    adjustment.adjustedSection1TerrorismPremium,
    adjustment.adjustedSection1Esl,
    adjustment.adjustedSection1Gst,
    adjustment.adjustedSection1Sd,
    adjustment.adjustedSection1TotalPremium,
  );
  const adjustedSection2 = adjustmentSection(
    adjustment.adjustedSection2TrueBasePremium,
    0,
    adjustment.adjustedSection2Esl,
    adjustment.adjustedSection2Gst,
    adjustment.adjustedSection2Sd,
    adjustment.adjustedSection2TotalPremium,
  );
  const totalSection1 = adjustmentSection(
    adjustment.totalSection1TrueBasePremium,
    adjustment.totalSection1TerrorismPremium,
    adjustment.totalSection1Esl,
    adjustment.totalSection1Gst,
    adjustment.totalSection1Sd,
    adjustment.totalSection1TotalPremium,
  );
  const totalSection2 = adjustmentSection(
    adjustment.totalSection2TrueBasePremium,
    0,
    adjustment.totalSection2Esl,
    adjustment.totalSection2Gst,
    adjustment.totalSection2Sd,
    adjustment.totalSection2TotalPremium,
  );

  const deltaSection1 = adjustmentSection(
    totalSection1.trueBasePremium - originalSection1.trueBasePremium,
    totalSection1.terrorismPremium - originalSection1.terrorismPremium,
    totalSection1.esl - originalSection1.esl,
    totalSection1.gst - originalSection1.gst,
    totalSection1.sd - originalSection1.sd,
    totalSection1.totalPremium - originalSection1.totalPremium,
  );
  const deltaSection2 = adjustmentSection(
    totalSection2.trueBasePremium - originalSection2.trueBasePremium,
    0,
    totalSection2.esl - originalSection2.esl,
    totalSection2.gst - originalSection2.gst,
    totalSection2.sd - originalSection2.sd,
    totalSection2.totalPremium - originalSection2.totalPremium,
  );

  return {
    adjustedTurnover: adjustment.adjustedTurnover,
    stampDutyExempt: adjustment.stampDutyExempt,
    adjustedDate: adjustment.adjustedDate ?? new Date().toISOString(),
    adjustedContractWorksBasePremium:
      adjustment.adjustedSection1TrueBasePremium,
    adjustedContractWorksTerrorismPremium:
      adjustment.adjustedSection1TerrorismPremium,
    adjustedSection1Esl: adjustment.adjustedSection1Esl,
    adjustedSection1Gst: adjustment.adjustedSection1Gst,
    adjustedSection1Sd: adjustment.adjustedSection1Sd,
    adjustedContractWorksTotalPremium: adjustment.adjustedSection1TotalPremium,
    adjustedLiabilityBasePremium: adjustment.adjustedSection2TrueBasePremium,
    adjustedSection2Esl: adjustment.adjustedSection2Esl,
    adjustedSection2Gst: adjustment.adjustedSection2Gst,
    adjustedSection2Sd: adjustment.adjustedSection2Sd,
    adjustedLiabilityTotalPremium: adjustment.adjustedSection2TotalPremium,
    totalContractWorksBasePremium: deltaSection1.trueBasePremium,
    totalContractWorksTerrorismPremium: deltaSection1.terrorismPremium,
    totalSection1Esl: deltaSection1.esl,
    totalSection1Gst: deltaSection1.gst,
    totalSection1Sd: deltaSection1.sd,
    totalContractWorksTotalPremium: deltaSection1.totalPremium,
    totalLiabilityBasePremium: deltaSection2.trueBasePremium,
    totalSection2Esl: deltaSection2.esl,
    totalSection2Gst: deltaSection2.gst,
    totalSection2Sd: deltaSection2.sd,
    totalLiabilityTotalPremium: deltaSection2.totalPremium,
    adjustedTotalPremium: adjustment.adjustedTotalPremium,
    breakdown: {
      originalTurnover: row.estimatedTurnover,
      adjustmentTurnover: adjustment.adjustedTurnover,
      stampDutyExempt: adjustment.stampDutyExempt,
      original: {
        section1: originalSection1,
        section2: originalSection2,
        total: adjustmentSection(
          originalSection1.trueBasePremium + originalSection2.trueBasePremium,
          originalSection1.terrorismPremium,
          originalSection1.esl + originalSection2.esl,
          originalSection1.gst + originalSection2.gst,
          originalSection1.sd + originalSection2.sd,
          num(premium?.originalTotalPremium),
        ),
      },
      adjustment: {
        section1: adjustedSection1,
        section2: adjustedSection2,
        total: adjustmentSection(
          adjustedSection1.trueBasePremium + adjustedSection2.trueBasePremium,
          adjustedSection1.terrorismPremium,
          adjustedSection1.esl + adjustedSection2.esl,
          adjustedSection1.gst + adjustedSection2.gst,
          adjustedSection1.sd + adjustedSection2.sd,
          adjustedSection1.totalPremium + adjustedSection2.totalPremium,
        ),
      },
      delta: {
        section1: deltaSection1,
        section2: deltaSection2,
        total: adjustmentSection(
          deltaSection1.trueBasePremium + deltaSection2.trueBasePremium,
          deltaSection1.terrorismPremium,
          deltaSection1.esl + deltaSection2.esl,
          deltaSection1.gst + deltaSection2.gst,
          deltaSection1.sd + deltaSection2.sd,
          adjustment.adjustedTotalPremium,
        ),
      },
    },
  };
}

export function parseLegacyNoteDescription(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<Notes")) {
    return trimmed;
  }
  const notes: string[] = [];
  for (const match of trimmed.matchAll(
    /<Note\b[^>]*\bNoteHeader="([^"]*)"[^>]*\bNoteValue="([^"]*)"[^>]*\/?>/gi,
  )) {
    const header = match[1]?.trim() ?? "";
    const value = match[2]?.trim() ?? "";
    if (header && value) notes.push(`${header}: ${value}`);
    else if (header) notes.push(header);
    else if (value) notes.push(value);
  }
  return notes.length > 0 ? notes.join("\n") : trimmed;
}

function mapLegacyNotes(
  row: LegacyPolicyRow,
  policyUuid: string,
): PolicyNote[] {
  return row.notes.map((note) => ({
    policyNoteId: note.policyNoteId,
    policyId: policyUuid,
    policyNoteTypeId: note.policyNoteTypeId,
    description: note.description,
    createdWhen:
      note.createdWhen ?? row.createdWhen ?? new Date().toISOString(),
    createdBy: note.createdBy || "migrate:mssql",
  }));
}

function mapLegacyWordings(wordings: LegacyPolicyWording[]) {
  const selectedWordingIds = [
    ...new Set(
      wordings
        .map((item) => item.carWordingId)
        .filter((id): id is number => id != null && id > 0),
    ),
  ];
  const customWordings = wordings.map((item) => ({
    subject: item.subject,
    content: item.content,
  }));
  return { selectedWordingIds, customWordings };
}

function mapLegacyExcesses(
  excesses: LegacyPolicyExcesses,
  estimatedTurnover: number,
  liabilityLimitBand: number,
): CarExcesses {
  const defaults = referenceData.defaultExcesses;
  const normalized = normalizeExcesses(excesses, estimatedTurnover);
  const visible = visibleExcessFields({
    estimatedTurnover,
    liabilityLimitBand,
  });
  const next: CarExcesses = { ...normalized };
  for (const field of visible) {
    const key = field.key as ExcessFieldKey;
    if (!next[key]?.trim()) {
      next[key] = defaults[key] ?? "";
    }
  }
  return next;
}

function mapLegacySubLimits(subLimits: LegacyPolicySubLimits): CarSubLimits {
  return normalizeSubLimits(subLimits);
}

/** Normalise a raw MSSQL policies.sql row into LegacyPolicyRow. */
export function normaliseLegacyPolicyRow(
  raw: Record<string, unknown>,
  extras?: {
    wordings?: LegacyPolicyWording[];
    notes?: LegacyPolicyNote[];
  },
): LegacyPolicyRow {
  const hasPremium =
    raw.contractWorksBasePremium != null || raw.originalTotalPremium != null;
  const hasAdjustment = bool(raw.hasAdjustment);

  const premium: LegacyPolicyPremium | null = hasPremium
    ? {
        contractWorksCalculatedBasePremium: num(
          raw.contractWorksCalculatedBasePremium,
        ),
        contractWorksBasePremium: num(raw.contractWorksBasePremium),
        contractWorksPlantPremium: num(raw.contractWorksPlantPremium),
        contractWorksPlantESL: num(raw.contractWorksPlantESL),
        contractWorksESL: num(raw.contractWorksESL),
        contractWorksGST: num(raw.contractWorksGST),
        contractWorksStampDuty: num(raw.contractWorksStampDuty),
        contractWorksTerrorismPremium: num(raw.contractWorksTerrorismPremium),
        contractWorksPlantTerrorismPremium: num(
          raw.contractWorksPlantTerrorismPremium,
        ),
        contractWorksDisplayHomesPremium: num(
          raw.contractWorksDisplayHomesPremium,
        ),
        contractWorksExistingStructurePremium: num(
          raw.contractWorksExistingStructurePremium,
        ),
        contractWorksTotalPremium: num(raw.contractWorksTotalPremium),
        liabilityCalculatedBasePremium: num(raw.liabilityCalculatedBasePremium),
        liabilityBasePremium: num(raw.liabilityBasePremium),
        liabilityESL: num(raw.liabilityESL),
        liabilityGST: num(raw.liabilityGST),
        liabilityStampDuty: num(raw.liabilityStampDuty),
        liabilityTotalPremium: num(raw.liabilityTotalPremium),
        combinedBrokerFee: num(raw.combinedBrokerFee),
        originalTotalPremium: num(raw.originalTotalPremium),
      }
    : null;

  const rating: LegacyPolicyRating | null =
    raw.priceId != null
      ? {
          priceId: num(raw.priceId),
          stampDutyId: num(raw.stampDutyId),
          eslId: num(raw.eslId),
          plantRate: num(raw.plantRate),
          eslRate: num(raw.eslRate),
          plantEslRate: num(raw.plantEslRate),
          contractWorksStampDutyRate: num(raw.contractWorksStampDutyRate),
          liabilityStampDutyRate: num(raw.liabilityStampDutyRate),
          contractWorksAppliedRate: num(raw.contractWorksAppliedRate),
          liabilityAppliedRate: num(raw.liabilityAppliedRate),
          contractWorksMinPremium: num(raw.contractWorksMinPremium),
          liabilityMinPremium: num(raw.liabilityMinPremium),
          plantValueMin: num(raw.plantValueMin),
          plantValueMax: num(raw.plantValueMax),
          terrorismRate: num(raw.terrorismRate),
        }
      : null;

  const adjustment: LegacyPolicyAdjustment | null = hasAdjustment
    ? {
        adjustedTurnover: num(raw.adjustedTurnover),
        stampDutyExempt: bool(raw.stampDutyExempt),
        adjustedTotalPremium: num(raw.adjustedTotalPremium),
        originalTotalPremium: num(raw.originalTotalPremium),
        adjustedDate: raw.adjustedDate ? isoDateTime(raw.adjustedDate) : null,
        adjustedSection1TrueBasePremium: num(
          raw.adjustedSection1TrueBasePremium,
        ),
        adjustedSection1TerrorismPremium: num(
          raw.adjustedSection1TerrorismPremium,
        ),
        adjustedSection1Esl: num(raw.adjustedSection1Esl),
        adjustedSection1Gst: num(raw.adjustedSection1Gst),
        adjustedSection1Sd: num(raw.adjustedSection1Sd),
        adjustedSection1TotalPremium: num(raw.adjustedSection1TotalPremium),
        adjustedSection2TrueBasePremium: num(
          raw.adjustedSection2TrueBasePremium,
        ),
        adjustedSection2Esl: num(raw.adjustedSection2Esl),
        adjustedSection2Gst: num(raw.adjustedSection2Gst),
        adjustedSection2Sd: num(raw.adjustedSection2Sd),
        adjustedSection2TotalPremium: num(raw.adjustedSection2TotalPremium),
        totalSection1TrueBasePremium: num(raw.totalSection1TrueBasePremium),
        totalSection1TerrorismPremium: num(raw.totalSection1TerrorismPremium),
        totalSection1Esl: num(raw.totalSection1Esl),
        totalSection1Gst: num(raw.totalSection1Gst),
        totalSection1Sd: num(raw.totalSection1Sd),
        totalSection1TotalPremium: num(raw.totalSection1TotalPremium),
        totalSection2TrueBasePremium: num(raw.totalSection2TrueBasePremium),
        totalSection2Esl: num(raw.totalSection2Esl),
        totalSection2Gst: num(raw.totalSection2Gst),
        totalSection2Sd: num(raw.totalSection2Sd),
        totalSection2TotalPremium: num(raw.totalSection2TotalPremium),
        totalTotalPremium: num(raw.totalTotalPremium),
      }
    : null;

  const coverTypeId = num(raw.coverTypeId, 1);

  return {
    policyId: num(raw.policyId),
    clientId: num(raw.clientId),
    policyNumber: String(raw.policyNumber ?? "").trim(),
    policyAction: String(raw.policyAction ?? "NEW").trim(),
    policyStatusId: num(raw.policyStatusId, 1),
    postcode: String(raw.postcode ?? "").trim(),
    stateCode: String(raw.stateCode ?? "NSW").trim(),
    dateStart: dateOnly(raw.dateStart),
    dateEnd: dateOnly(raw.dateEnd),
    insurerCode: String(raw.insurerCode ?? "ATC").trim(),
    createdWhen: raw.createdWhen ? isoDateTime(raw.createdWhen) : null,
    coverTypeId,
    siteAddress: String(raw.siteAddress ?? "").trim(),
    insuredName: String(raw.insuredName ?? "").trim(),
    estimatedTurnover: num(raw.estimatedTurnover),
    businessActivities: String(raw.businessActivities ?? "").trim(),
    insuredContracts: String(raw.insuredContracts ?? "").trim(),
    geographicalScopes: String(raw.geographicalScopes ?? "").trim(),
    plantEquipment: num(raw.plantEquipment),
    existingStructure: num(raw.existingStructure),
    displayHomes: num(raw.displayHomes),
    claimsCountLast3Years: num(raw.claimsCountLast3Years),
    anyClaimsExceed20k: bool(raw.anyClaimsExceed20k),
    declarationConfirmed:
      bool(raw.declarationConfirmed) || num(raw.policyStatusId, 1) !== 1,
    contractWorksSumInsured: num(raw.contractWorksSumInsured),
    liabilityLimitBand: num(raw.liabilityLimitBand, 1),
    hasExistingContractWorksCover: bool(raw.hasExistingContractWorksCover),
    currentInsurer: String(raw.currentInsurer ?? "").trim(),
    maximumConstructionPeriod: positiveInt(
      raw.maximumConstructionPeriod,
      defaultConstructionPeriodMonths(coverTypeId),
    ),
    maximumMaintenancePeriod: positiveInt(raw.maximumMaintenancePeriod, 12),
    contractWorksExistingStructurePremium: num(
      raw.contractWorksExistingStructurePremium,
    ),
    contractWorksDisplayHomesPremium: num(raw.contractWorksDisplayHomesPremium),
    manualTaxOverride: bool(raw.manualTaxOverride),
    subLimits: subLimitsFromRaw(raw),
    excludedContracts1: text(raw.excludedContracts1),
    excludedContracts2: text(raw.excludedContracts2),
    excludedContracts3: text(raw.excludedContracts3),
    excesses: excessesFromRaw(raw),
    wordings: extras?.wordings ?? [],
    notes: extras?.notes ?? [],
    premium,
    rating,
    adjustment,
  };
}

/**
 * Legacy MSSQL reuses policy numbers across renewals; Postgres enforces
 * case-insensitive uniqueness. Keep the earliest row's number; suffix later
 * renewals with inception date parts, then UUID hash if all are taken:
 * ATCCWI0487-2024 → ATCCWI0487-2024-06 → ATCCWI0487-2024-06-15 → hash.
 */
function renewalPolicyNumberCandidates(
  base: string,
  dateStart: string,
  policyId: number,
): string[] {
  const inception = dateOnly(dateStart);
  const year = inception.slice(0, 4);
  const month = inception.slice(5, 7);
  const uuid = legacyPolicyUuid(policyId);

  return [
    `${base}-${year}`,
    `${base}-${year}-${month}`,
    `${base}-${inception}`,
    `${base}-${uuid.slice(0, 8)}`,
    `${base}-${uuid.replace(/-/g, "").slice(0, 12)}`,
  ];
}

function pickUniquePolicyNumber(
  candidates: string[],
  usedKeys: Set<string>,
): string {
  for (const candidate of candidates) {
    if (!usedKeys.has(candidate.toLowerCase())) return candidate;
  }
  return candidates.at(-1)!;
}

export function dedupeLegacyPolicyNumbers(rows: LegacyPolicyRow[]): {
  rows: LegacyPolicyRow[];
  suffixed: number;
} {
  const rankByPolicyId = new Map<number, number>();
  const groups = new Map<string, LegacyPolicyRow[]>();

  for (const row of rows) {
    const key = row.policyNumber.trim().toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => {
      const aCreated = a.createdWhen ?? "";
      const bCreated = b.createdWhen ?? "";
      if (aCreated !== bCreated) return aCreated.localeCompare(bCreated);
      return a.policyId - b.policyId;
    });
    group.forEach((row, index) => {
      rankByPolicyId.set(row.policyId, index);
    });
  }

  const usedKeys = new Set<string>();
  const assigned = new Map<number, string>();

  for (const row of rows) {
    if (rankByPolicyId.get(row.policyId) !== 0) continue;
    const base = row.policyNumber.trim();
    usedKeys.add(base.toLowerCase());
    assigned.set(row.policyId, base);
  }

  const duplicates = rows
    .filter((row) => (rankByPolicyId.get(row.policyId) ?? 0) > 0)
    .sort((a, b) => {
      const keyA = a.policyNumber.trim().toLowerCase();
      const keyB = b.policyNumber.trim().toLowerCase();
      if (keyA !== keyB) return keyA.localeCompare(keyB);
      return (
        (rankByPolicyId.get(a.policyId) ?? 0) -
        (rankByPolicyId.get(b.policyId) ?? 0)
      );
    });

  let suffixed = 0;
  for (const row of duplicates) {
    suffixed += 1;
    const base = row.policyNumber.trim();
    const finalNumber = pickUniquePolicyNumber(
      renewalPolicyNumberCandidates(base, row.dateStart, row.policyId),
      usedKeys,
    );

    usedKeys.add(finalNumber.toLowerCase());
    assigned.set(row.policyId, finalNumber);
  }

  const deduped = rows.map((row) => {
    const finalNumber = assigned.get(row.policyId);
    if (!finalNumber || finalNumber === row.policyNumber.trim()) return row;
    return { ...row, policyNumber: finalNumber };
  });

  return { rows: deduped, suffixed };
}

export function legacyPolicyRowToPolicy(row: LegacyPolicyRow): Policy {
  const premium = premiumFromLegacy(row);
  const rating = ratingFromLegacy(row);
  const policyId = legacyPolicyUuid(row.policyId);
  const wordings = row.wordings ?? [];
  const notes = row.notes ?? [];
  const { selectedWordingIds, customWordings } = mapLegacyWordings(wordings);
  const mappedNotes = mapLegacyNotes({ ...row, notes }, policyId);
  const referralReasons = mappedNotes
    .filter((note) => note.policyNoteTypeId === REFERRAL_NOTE_TYPE_ID)
    .map((note) => note.description)
    .filter(Boolean);

  return {
    policyId,
    clientId: legacyClientUuid(row.clientId),
    policyNumber: row.policyNumber,
    policyCategoryId: policyCategoryId(row.policyAction),
    policyStatusId: row.policyStatusId,
    postcode: row.postcode,
    stateId: stateIdForCode(row.stateCode),
    dateEffective: row.dateStart,
    dateStart: row.dateStart,
    dateEnd: row.dateEnd,
    createdWhen: row.createdWhen ?? new Date().toISOString(),
    createdBy: "migrate:mssql",
    insurerCode: row.insurerCode,
    isDraft: !premium,
    notes: mappedNotes,
    documents: [],
    car: {
      coverTypeId: row.coverTypeId,
      annualCoverTypeId: row.coverTypeId === 1 ? 1 : null,
      siteAddress: row.siteAddress,
      insuredName: row.insuredName,
      estimatedTurnover: row.estimatedTurnover,
      businessActivities: row.businessActivities,
      insuredContracts: row.insuredContracts,
      geographicalScopes: row.geographicalScopes,
      plantEquipment: row.plantEquipment,
      existingStructure: row.existingStructure,
      displayHomes: row.displayHomes,
      claimsCountLast3Years: row.claimsCountLast3Years,
      anyClaimsExceed20k: row.anyClaimsExceed20k,
      declarationConfirmed: row.declarationConfirmed,
      contractWorksSumInsured: row.contractWorksSumInsured,
      liabilityLimitBand: row.liabilityLimitBand,
      hasExistingContractWorksCover: row.hasExistingContractWorksCover,
      currentInsurer: row.currentInsurer,
      maximumConstructionPeriod: row.maximumConstructionPeriod,
      maximumMaintenancePeriod: row.maximumMaintenancePeriod,
      contractWorksExistingStructurePremium:
        row.contractWorksExistingStructurePremium,
      contractWorksDisplayHomesPremium: row.contractWorksDisplayHomesPremium,
      subLimits: mapLegacySubLimits(row.subLimits ?? subLimitsFromRaw({})),
      excesses: mapLegacyExcesses(
        row.excesses ?? excessesFromRaw({}),
        row.estimatedTurnover,
        row.liabilityLimitBand,
      ),
      excludedContracts1: row.excludedContracts1 ?? "",
      excludedContracts2: row.excludedContracts2 ?? "",
      excludedContracts3: row.excludedContracts3 ?? "",
      selectedWordingIds,
      customWordings,
      referralReasons,
      premium,
      rating: rating
        ? {
            ...rating,
            terrorismTier: "",
            isTerrorismRateExist: rating.terrorismRate > 0,
          }
        : undefined,
      adjusted: Boolean(row.adjustment),
      adjustment:
        row.adjustment && premium
          ? buildCarAdjustmentRecord(row, premium, row.adjustment)
          : undefined,
    },
  };
}

export {
  num as legacyNum,
  bool as legacyBool,
  dateOnly as legacyDateOnly,
  positiveInt,
  defaultConstructionPeriodMonths,
};
