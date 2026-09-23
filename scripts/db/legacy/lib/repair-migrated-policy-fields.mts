/**
 * Backfill missing required CAR policy fields on migrated rows using app defaults.
 */
import { referenceData } from "../../../../app/lib/reference-data";
import type { CarExcesses, CarSubLimits } from "../../../../app/lib/db/types";
import {
  normalizeExcesses,
  visibleExcessFields,
  type ExcessFieldKey,
} from "../../../../app/lib/policies/excesses";
import {
  normalizeSubLimits,
  SUB_LIMIT_FIELDS,
} from "../../../../app/lib/policies/sub-limits";
import {
  defaultConstructionPeriodMonths,
  positiveInt,
} from "./legacy-policy-mapper.mts";

export type MigratedPolicyRepairInput = {
  policyStatusId: number;
  postcode: string;
  dateStart: string;
  dateEnd: string;
  coverTypeId: number;
  annualCoverTypeId: number | null;
  businessActivities: string;
  insuredContracts: string;
  geographicalScopes: string;
  maximumConstructionPeriod: number;
  maximumMaintenancePeriod: number;
  declarationConfirmed: boolean;
  liabilityLimitBand: number;
  estimatedTurnover: number;
  subLimits: Record<string, string>;
  excesses: CarExcesses | Record<string, string | undefined>;
  excludedContracts1: string;
  excludedContracts2: string;
  excludedContracts3: string;
  siteAddress?: string;
};

export type MigratedPolicyRepairPatch = {
  policy?: {
    postcode?: string;
    dateEnd?: Date;
  };
  policyCar?: {
    annualCoverTypeId?: number | null;
    businessActivities?: string;
    insuredContracts?: string;
    geographicalScopes?: string;
    maximumConstructionPeriod?: number;
    maximumMaintenancePeriod?: number;
    declarationConfirmed?: boolean;
    subLimits?: CarSubLimits;
    excesses?: CarExcesses;
    excludedContracts1?: string;
    excludedContracts2?: string;
    excludedContracts3?: string;
  };
};

function addCalendarMonths(isoDate: string, months: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  date.setMonth(date.getMonth() + months);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoDateOnly(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** Invalid AU postcodes from legacy — keep first four digits when possible. */
export function repairPostcode(postcode: string): string {
  const trimmed = postcode.trim();
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(0, 4);
  return "2000";
}

function defaultSubLimitsForCover(coverTypeId: number): CarSubLimits {
  return coverTypeId === 3
    ? { ...referenceData.defaultSubLimits.ownerBuilder }
    : { ...referenceData.defaultSubLimits.annual };
}

function defaultInsuredContracts(coverTypeId: number): string {
  if (coverTypeId === 1) {
    return referenceData.defaultTexts.insuredContractsAnnualTransfer;
  }
  return referenceData.defaultTexts.insuredContractsSingle;
}

function defaultGeographicalScope(
  coverTypeId: number,
  siteAddress: string,
): string {
  if (coverTypeId === 1) {
    return referenceData.defaultTexts.geographicalScopeAnnual;
  }
  return siteAddress.trim();
}

function capDateEnd(
  dateStart: string,
  dateEnd: string,
  coverTypeId: number,
): string {
  if (!dateStart || !dateEnd) return dateEnd;
  const maxMonths = coverTypeId === 3 ? 12 : 18;
  const maxEnd = addCalendarMonths(dateStart, maxMonths);
  if (!maxEnd) return dateEnd;
  return dateEnd > maxEnd ? maxEnd : dateEnd;
}

function repairSubLimits(
  subLimits: Record<string, string>,
  coverTypeId: number,
): CarSubLimits {
  const defaults = defaultSubLimitsForCover(coverTypeId);
  const merged = { ...defaults, ...subLimits };
  for (const field of SUB_LIMIT_FIELDS) {
    if (!merged[field.key]?.trim()) {
      merged[field.key] = defaults[field.key];
    }
  }
  return normalizeSubLimits(merged as CarSubLimits);
}

function repairExcesses(
  excesses: CarExcesses | Record<string, string | undefined>,
  estimatedTurnover: number,
  liabilityLimitBand: number,
): CarExcesses {
  const defaults = referenceData.defaultExcesses;
  const normalized = normalizeExcesses(excesses, {
    estimatedTurnover,
    liabilityLimitBand,
  });
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

function excludedContractDefaults() {
  return {
    excludedContracts1: referenceData.defaultTexts.excludedContracts1,
    excludedContracts2: referenceData.defaultTexts.excludedContracts2,
    excludedContracts3: referenceData.defaultTexts.excludedContracts3,
  };
}

export function buildMigratedPolicyRepairPatch(
  input: MigratedPolicyRepairInput,
): MigratedPolicyRepairPatch | null {
  const patch: MigratedPolicyRepairPatch = {};
  let changed = false;

  const nextPostcode = repairPostcode(input.postcode);
  if (nextPostcode !== input.postcode.trim()) {
    patch.policy = { ...patch.policy, postcode: nextPostcode };
    changed = true;
  }

  const start = isoDateOnly(input.dateStart);
  const end = isoDateOnly(input.dateEnd);
  const cappedEnd = capDateEnd(start, end, input.coverTypeId);
  if (cappedEnd !== end) {
    patch.policy = {
      ...patch.policy,
      dateEnd: new Date(`${cappedEnd}T00:00:00.000Z`),
    };
    changed = true;
  }

  const carPatch: NonNullable<MigratedPolicyRepairPatch["policyCar"]> = {};

  if (input.coverTypeId === 1 && (input.annualCoverTypeId ?? 0) <= 0) {
    carPatch.annualCoverTypeId = 1;
    changed = true;
  }

  if (!input.businessActivities.trim()) {
    carPatch.businessActivities = referenceData.defaultTexts.businessActivities;
    changed = true;
  }

  if (!input.insuredContracts.trim()) {
    carPatch.insuredContracts = defaultInsuredContracts(input.coverTypeId);
    changed = true;
  }

  if (!input.geographicalScopes.trim()) {
    carPatch.geographicalScopes = defaultGeographicalScope(
      input.coverTypeId,
      input.siteAddress ?? "",
    );
    changed = true;
  }

  const nextConstruction = positiveInt(
    input.maximumConstructionPeriod,
    defaultConstructionPeriodMonths(input.coverTypeId),
  );
  if (nextConstruction !== input.maximumConstructionPeriod) {
    carPatch.maximumConstructionPeriod = nextConstruction;
    changed = true;
  }

  const nextMaintenance = positiveInt(input.maximumMaintenancePeriod, 12);
  if (nextMaintenance !== input.maximumMaintenancePeriod) {
    carPatch.maximumMaintenancePeriod = nextMaintenance;
    changed = true;
  }

  if (!input.declarationConfirmed) {
    carPatch.declarationConfirmed = true;
    changed = true;
  }

  const repairedSubLimits = repairSubLimits(input.subLimits, input.coverTypeId);
  const subLimitsChanged = SUB_LIMIT_FIELDS.some(
    (field) =>
      normalizeSubLimits(input.subLimits as CarSubLimits)[field.key] !==
      repairedSubLimits[field.key],
  );
  if (subLimitsChanged) {
    carPatch.subLimits = repairedSubLimits;
    changed = true;
  }

  const currentExcesses = (input.excesses ?? {}) as CarExcesses;
  const repairedExcesses = repairExcesses(
    currentExcesses,
    input.estimatedTurnover,
    input.liabilityLimitBand,
  );
  const excessChanged = Object.keys(repairedExcesses).some(
    (key) =>
      currentExcesses[key as keyof CarExcesses] !==
      repairedExcesses[key as keyof CarExcesses],
  );

  const excludedDefaults = excludedContractDefaults();
  const excludedChanged =
    !String(input.excludedContracts1 ?? "").trim() ||
    !String(input.excludedContracts2 ?? "").trim() ||
    !String(input.excludedContracts3 ?? "").trim();

  if (excessChanged) {
    carPatch.excesses = repairedExcesses;
    changed = true;
  }
  if (excludedChanged) {
    if (!String(input.excludedContracts1 ?? "").trim()) {
      carPatch.excludedContracts1 = excludedDefaults.excludedContracts1;
    }
    if (!String(input.excludedContracts2 ?? "").trim()) {
      carPatch.excludedContracts2 = excludedDefaults.excludedContracts2;
    }
    if (!String(input.excludedContracts3 ?? "").trim()) {
      carPatch.excludedContracts3 = excludedDefaults.excludedContracts3;
    }
    changed = true;
  }

  if (Object.keys(carPatch).length > 0) {
    patch.policyCar = carPatch;
  }

  return changed ? patch : null;
}
