import {
  EXCESS_CONTRACT_VALUE_BAND_THRESHOLD,
  WORKER_TO_WORKER_TURNOVER_THRESHOLD,
} from "~/constants";
import { stripAmountCommas } from "~/lib/amount-input";
import type { CarExcesses } from "~/lib/db/types";

export type ExcessNoteFieldKey =
  | "excessAdditionalNotes"
  | "excessLegalLiabilityAdditionalNotes";

export type ExcessFieldKey = Exclude<keyof CarExcesses, ExcessNoteFieldKey>;

/**
 * Maps PolicyCARExcessDefault catalogue ids → flat form field keys.
 * Ids match db.txt / seed rows (group headings and additional-notes row omitted).
 */
export const EXCESS_DEFAULT_FIELD_BY_ID: Partial<
  Record<number, ExcessFieldKey>
> = {
  1: "excessPlantEquipment",
  3: "excessUpTo2MMinorPerils",
  4: "excessUpTo2MMajorPerils",
  6: "excessOver2MMinorPerils",
  7: "excessOver2MMajorPerils",
  9: "excessWorkerToWorker",
  11: "excessUpTo2MLimit10M",
  12: "excessUpTo2MLimit20M",
  14: "excessOver2MLimit10M",
  15: "excessOver2MLimit20M",
};

/** Old MSSQL PolicyCARExcess columns → flat form keys. */
const LEGACY_EXCESS_KEY: Record<string, ExcessFieldKey> = {
  excessSection1A: "excessPlantEquipment",
  excessSection1B: "excessUpTo2MMinorPerils",
  excessSection1E: "excessUpTo2MMajorPerils",
  excessSection1C: "excessOver2MMinorPerils",
  excessSection1D: "excessOver2MMajorPerils",
  excessSection2A: "excessWorkerToWorker",
  // Legacy DB uses 2B for $10M limit; 2C is usually N/A.
  excessSection2B: "excessUpTo2MLimit10M",
  excessSection2C: "excessUpTo2MLimit10M",
  excessSection2D: "excessUpTo2MLimit20M",
  excessSection2E: "excessOver2MLimit10M",
  excessSection2F: "excessOver2MLimit20M",
};

const PERILS_BAND_EXCESS_PAIRS: ReadonlyArray<
  readonly [ExcessFieldKey, ExcessFieldKey]
> = [
  ["excessUpTo2MMinorPerils", "excessOver2MMinorPerils"],
  ["excessUpTo2MMajorPerils", "excessOver2MMajorPerils"],
];

export const PERILS_EXCESS_FIELD_KEYS: readonly ExcessFieldKey[] = [
  "excessUpTo2MMinorPerils",
  "excessUpTo2MMajorPerils",
  "excessOver2MMinorPerils",
  "excessOver2MMajorPerils",
];

const LIABILITY_BAND_EXCESS_PAIRS: ReadonlyArray<
  readonly [ExcessFieldKey, ExcessFieldKey]
> = [
  ["excessUpTo2MLimit10M", "excessOver2MLimit10M"],
  ["excessUpTo2MLimit20M", "excessOver2MLimit20M"],
];

/** Reference `liabilityLimitBands` id — Section 2 not insured. */
export const LIABILITY_LIMIT_NOT_INSURED_BAND_ID = 3;

export type ExcessBandContext = {
  /** Section 1 contract works — $2M band for Section 2 limit excess rows. */
  contractWorksSumInsured?: unknown;
  /** Section 2 limit of liability ($10m / $20m / not insured). */
  liabilityLimitBand?: unknown;
};

export const LEGAL_LIABILITY_EXCESS_FIELD_KEYS: readonly ExcessFieldKey[] = [
  "excessWorkerToWorker",
  "excessUpTo2MLimit10M",
  "excessUpTo2MLimit20M",
  "excessOver2MLimit10M",
  "excessOver2MLimit20M",
];

export function resolveLiabilityLimitMillions(
  liabilityLimitBand: unknown,
): 10 | 20 | null {
  const band = Number(liabilityLimitBand);
  if (band === 1) return 10;
  if (band === 2) return 20;
  return null;
}

export function isLegalLiabilityInsured(liabilityLimitBand: unknown): boolean {
  const band = Number(liabilityLimitBand);
  return (
    Number.isFinite(band) &&
    band > 0 &&
    band !== LIABILITY_LIMIT_NOT_INSURED_BAND_ID
  );
}

function normalizeExcessBandContext(
  context?: unknown | ExcessBandContext,
): ExcessBandContext {
  if (context == null) return {};
  if (typeof context === "object" && !Array.isArray(context)) {
    return context as ExcessBandContext;
  }
  return { contractWorksSumInsured: context };
}

export type ExcessGroup = "contractWorks" | "legalLiability";

export type ContractValueBand = "upTo2m" | "from2mTo5m";

/**
 * Which Major / Minor Perils form row set applies for the selected limit of liability.
 * $10M → up-to band defaults; $20M → over band defaults; not insured → none.
 */
export function resolvePerilsStorageBand(
  liabilityLimitBand: unknown,
): ContractValueBand | null {
  const limit = resolveLiabilityLimitMillions(liabilityLimitBand);
  if (limit === 10) return "upTo2m";
  if (limit === 20) return "from2mTo5m";
  return null;
}

export type ExcessFieldConfig = {
  key: ExcessFieldKey;
  group: ExcessGroup;
  label: string;
  /** Shown under the input (e.g. "each and every loss"). */
  description?: string;
  /** Contract-value band this field belongs to (visibility + grouping). */
  band?: ContractValueBand;
  /** Legal liability: match selected Limit of Liability ($10m / $20m). */
  liabilityLimitMillions?: 10 | 20;
  tooltip?: string;
};

export const EXCESS_FIELDS: ExcessFieldConfig[] = [
  {
    key: "excessPlantEquipment",
    group: "contractWorks",
    label: "Named Insureds Construction Plant & Equipment",
    description: "each and every loss",
  },
  {
    key: "excessUpTo2MMajorPerils",
    group: "contractWorks",
    label: "Major Perils",
    description: "each and every loss",
    band: "upTo2m",
  },
  {
    key: "excessUpTo2MMinorPerils",
    group: "contractWorks",
    label: "Minor Perils",
    description: "each and every loss",
    band: "upTo2m",
  },
  {
    key: "excessOver2MMajorPerils",
    group: "contractWorks",
    label: "Major Perils",
    description: "each and every loss",
    band: "from2mTo5m",
  },
  {
    key: "excessOver2MMinorPerils",
    group: "contractWorks",
    label: "Minor Perils",
    description: "each and every loss",
    band: "from2mTo5m",
  },
  {
    key: "excessWorkerToWorker",
    group: "legalLiability",
    label: "Worker to Worker",
    description: "each and every occurrence",
  },
  {
    key: "excessUpTo2MLimit10M",
    group: "legalLiability",
    label: "$10M Limit of Liability",
    description: "each and every occurrence",
    band: "upTo2m",
    liabilityLimitMillions: 10,
  },
  {
    key: "excessUpTo2MLimit20M",
    group: "legalLiability",
    label: "$20M Limit of Liability",
    description: "each and every occurrence",
    band: "upTo2m",
    liabilityLimitMillions: 20,
  },
  {
    key: "excessOver2MLimit10M",
    group: "legalLiability",
    label: "$10M Limit of Liability",
    description: "each and every occurrence",
    band: "from2mTo5m",
    liabilityLimitMillions: 10,
  },
  {
    key: "excessOver2MLimit20M",
    group: "legalLiability",
    label: "$20M Limit of Liability",
    description: "each and every occurrence",
    band: "from2mTo5m",
    liabilityLimitMillions: 20,
  },
];

/** Resolve estimated turnover / project value into an excess band. */
export function resolveContractValueBand(
  estimatedTurnover: unknown,
): ContractValueBand | null {
  const raw = stripAmountCommas(estimatedTurnover);
  if (raw === "" || raw == null) return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value <= EXCESS_CONTRACT_VALUE_BAND_THRESHOLD) return "upTo2m";
  return "from2mTo5m";
}

const WORKER_TO_WORKER_EXCESS_UP_TO_THRESHOLD = "15000";
const WORKER_TO_WORKER_EXCESS_ABOVE_THRESHOLD = "25000";

/** Worker-to-Worker excess from estimated turnover; null when turnover is unset. */
export function resolveWorkerToWorkerExcess(
  estimatedTurnover: unknown,
): string | null {
  const raw = stripAmountCommas(estimatedTurnover);
  if (raw === "" || raw == null) return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value <= WORKER_TO_WORKER_TURNOVER_THRESHOLD) {
    return WORKER_TO_WORKER_EXCESS_UP_TO_THRESHOLD;
  }
  return WORKER_TO_WORKER_EXCESS_ABOVE_THRESHOLD;
}

/**
 * Major / Minor Perils from Section 2 limit of liability only
 * ($10M / $20M / not insured). Amounts from reference / catalogue defaults.
 */
export function perilsExcessValuesForLegalLiability(
  liabilityLimitBand: unknown,
  defaults: Pick<
    CarExcesses,
    | "excessUpTo2MMinorPerils"
    | "excessUpTo2MMajorPerils"
    | "excessOver2MMinorPerils"
    | "excessOver2MMajorPerils"
  >,
): Pick<
  CarExcesses,
  | "excessUpTo2MMinorPerils"
  | "excessUpTo2MMajorPerils"
  | "excessOver2MMinorPerils"
  | "excessOver2MMajorPerils"
> {
  const na = Object.fromEntries(
    PERILS_EXCESS_FIELD_KEYS.map((key) => [key, "N/A"]),
  ) as Pick<
    CarExcesses,
    | "excessUpTo2MMinorPerils"
    | "excessUpTo2MMajorPerils"
    | "excessOver2MMinorPerils"
    | "excessOver2MMajorPerils"
  >;

  const band = resolvePerilsStorageBand(liabilityLimitBand);
  if (!band) return na;

  const { minorKey, majorKey, minor, major } = perilsExcessDefaultsForBand(
    band,
    defaults,
  );
  return {
    ...na,
    [minorKey]: minor,
    [majorKey]: major,
  };
}

/** Default Major / Minor Perils amounts for a band (from reference / catalogue). */
export function perilsExcessDefaultsForBand(
  band: ContractValueBand,
  defaults: Pick<
    CarExcesses,
    | "excessUpTo2MMinorPerils"
    | "excessUpTo2MMajorPerils"
    | "excessOver2MMinorPerils"
    | "excessOver2MMajorPerils"
  >,
): { minorKey: ExcessFieldKey; majorKey: ExcessFieldKey; minor: string; major: string } {
  if (band === "upTo2m") {
    return {
      minorKey: "excessUpTo2MMinorPerils",
      majorKey: "excessUpTo2MMajorPerils",
      minor: defaults.excessUpTo2MMinorPerils,
      major: defaults.excessUpTo2MMajorPerils,
    };
  }
  return {
    minorKey: "excessOver2MMinorPerils",
    majorKey: "excessOver2MMajorPerils",
    minor: defaults.excessOver2MMinorPerils,
    major: defaults.excessOver2MMajorPerils,
  };
}

function liabilityLimitExcessKey(
  turnoverBand: ContractValueBand,
  limitMillions: 10 | 20,
): ExcessFieldKey {
  if (turnoverBand === "upTo2m") {
    return limitMillions === 10
      ? "excessUpTo2MLimit10M"
      : "excessUpTo2MLimit20M";
  }
  return limitMillions === 10
    ? "excessOver2MLimit10M"
    : "excessOver2MLimit20M";
}

/**
 * Section 2 legal liability excess values from contract works band + limit of liability.
 * Not insured or missing contract works band → worker default only; limit rows N/A.
 */
export function legalLiabilityExcessValuesFor(
  contractWorksSumInsured: unknown,
  liabilityLimitBand: unknown,
  defaults: Pick<
    CarExcesses,
    | "excessWorkerToWorker"
    | "excessUpTo2MLimit10M"
    | "excessUpTo2MLimit20M"
    | "excessOver2MLimit10M"
    | "excessOver2MLimit20M"
  >,
  estimatedTurnover?: unknown,
): Pick<
  CarExcesses,
  | "excessWorkerToWorker"
  | "excessUpTo2MLimit10M"
  | "excessUpTo2MLimit20M"
  | "excessOver2MLimit10M"
  | "excessOver2MLimit20M"
> {
  const na = Object.fromEntries(
    LEGAL_LIABILITY_EXCESS_FIELD_KEYS.map((key) => [key, "N/A"]),
  ) as Pick<
    CarExcesses,
    | "excessWorkerToWorker"
    | "excessUpTo2MLimit10M"
    | "excessUpTo2MLimit20M"
    | "excessOver2MLimit10M"
    | "excessOver2MLimit20M"
  >;

  if (!isLegalLiabilityInsured(liabilityLimitBand)) {
    return na;
  }

  const limitMillions = resolveLiabilityLimitMillions(liabilityLimitBand);
  const contractWorksBand = resolveContractValueBand(contractWorksSumInsured);
  const workerFromTurnover = resolveWorkerToWorkerExcess(estimatedTurnover);
  const withWorker = {
    ...na,
    excessWorkerToWorker:
      workerFromTurnover ?? defaults.excessWorkerToWorker,
  };
  if (!limitMillions || !contractWorksBand) {
    return withWorker;
  }

  const limitKey = liabilityLimitExcessKey(contractWorksBand, limitMillions);
  const limitAmount =
    limitKey === "excessUpTo2MLimit10M"
      ? defaults.excessUpTo2MLimit10M
      : limitKey === "excessUpTo2MLimit20M"
        ? defaults.excessUpTo2MLimit20M
        : limitKey === "excessOver2MLimit10M"
          ? defaults.excessOver2MLimit10M
          : defaults.excessOver2MLimit20M;
  return {
    ...withWorker,
    [limitKey]: limitAmount,
  };
}

/** Stable key for detecting contract-value band changes in the form. */
export function contractWorksLimitSyncKey(value: unknown): string {
  const band = resolveContractValueBand(value);
  const raw = stripAmountCommas(value);
  if (raw === "" || raw == null) return "none:";
  const numeric = typeof raw === "number" ? raw : Number(raw);
  return `${band ?? "none"}:${Number.isFinite(numeric) ? numeric : raw}`;
}

export function legalLiabilityExcessSyncKey(
  contractWorksSumInsured: unknown,
  liabilityLimitBand: unknown,
  estimatedTurnover?: unknown,
): string {
  const workerTier =
    resolveWorkerToWorkerExcess(estimatedTurnover) ?? "turnover-unset";
  return `${contractWorksLimitSyncKey(contractWorksSumInsured)}|${String(
    liabilityLimitBand ?? "",
  )}|${workerTier}`;
}

export function perilsExcessSyncKey(liabilityLimitBand: unknown): string {
  return String(liabilityLimitBand ?? "");
}

export type ActiveBandExcessAmounts = {
  minorPerils: string;
  majorPerils: string;
  limit10M: string;
  limit20M: string;
};

/**
 * Excess amounts for the turnover-active contract-value band only.
 * Empty strings when estimated turnover does not resolve to a band.
 */
type BandExcessSlice = Pick<
  CarExcesses,
  | "excessUpTo2MMinorPerils"
  | "excessUpTo2MMajorPerils"
  | "excessOver2MMinorPerils"
  | "excessOver2MMajorPerils"
  | "excessUpTo2MLimit10M"
  | "excessUpTo2MLimit20M"
  | "excessOver2MLimit10M"
  | "excessOver2MLimit20M"
>;

function activePerilsBandAmounts(
  excesses: BandExcessSlice,
  band: ContractValueBand,
): Pick<ActiveBandExcessAmounts, "minorPerils" | "majorPerils"> {
  if (band === "upTo2m") {
    return {
      minorPerils: excesses.excessUpTo2MMinorPerils || "N/A",
      majorPerils: excesses.excessUpTo2MMajorPerils || "N/A",
    };
  }
  return {
    minorPerils: excesses.excessOver2MMinorPerils || "N/A",
    majorPerils: excesses.excessOver2MMajorPerils || "N/A",
  };
}

function activeLiabilityBandAmounts(
  excesses: BandExcessSlice,
  band: ContractValueBand,
): Pick<ActiveBandExcessAmounts, "limit10M" | "limit20M"> {
  if (band === "upTo2m") {
    return {
      limit10M: excesses.excessUpTo2MLimit10M || "N/A",
      limit20M: excesses.excessUpTo2MLimit20M || "N/A",
    };
  }
  return {
    limit10M: excesses.excessOver2MLimit10M || "N/A",
    limit20M: excesses.excessOver2MLimit20M || "N/A",
  };
}

export function activeBandExcessAmounts(
  excesses:
    | Pick<
        CarExcesses,
        | "excessUpTo2MMinorPerils"
        | "excessUpTo2MMajorPerils"
        | "excessOver2MMinorPerils"
        | "excessOver2MMajorPerils"
        | "excessUpTo2MLimit10M"
        | "excessUpTo2MLimit20M"
        | "excessOver2MLimit10M"
        | "excessOver2MLimit20M"
      >
    | null
    | undefined,
  context?: unknown | ExcessBandContext,
): ActiveBandExcessAmounts {
  const empty: ActiveBandExcessAmounts = {
    minorPerils: "N/A",
    majorPerils: "N/A",
    limit10M: "N/A",
    limit20M: "N/A",
  };
  if (!excesses) return empty;

  const { contractWorksSumInsured, liabilityLimitBand } =
    normalizeExcessBandContext(context);
  const perilsBand = resolvePerilsStorageBand(liabilityLimitBand);
  const liabilityBand = resolveContractValueBand(contractWorksSumInsured);
  const limitMillions = resolveLiabilityLimitMillions(liabilityLimitBand);

  const perilsSlice =
    perilsBand != null
      ? activePerilsBandAmounts(excesses, perilsBand)
      : null;
  const liabilitySlice =
    isLegalLiabilityInsured(liabilityLimitBand) && liabilityBand != null
      ? activeLiabilityBandAmounts(excesses, liabilityBand)
      : null;

  const limit10M =
    limitMillions === 10
      ? (liabilitySlice?.limit10M ?? "N/A")
      : "N/A";
  const limit20M =
    limitMillions === 20
      ? (liabilitySlice?.limit20M ?? "N/A")
      : "N/A";

  return {
    minorPerils: perilsSlice?.minorPerils ?? "N/A",
    majorPerils: perilsSlice?.majorPerils ?? "N/A",
    limit10M,
    limit20M,
  };
}

export function isExcessFieldVisible(
  field: ExcessFieldConfig,
  opts: ExcessBandContext & {
    liabilityLimitBand?: unknown;
  },
): boolean {
  if (field.group === "contractWorks" && field.band) {
    const perilsBand = resolvePerilsStorageBand(opts.liabilityLimitBand);
    if (perilsBand != null) {
      return field.band === perilsBand;
    }
    // Not insured / unset: still show Major / Minor (values sync to N/A).
    return field.band === "upTo2m";
  }

  if (field.group === "legalLiability") {
    if (!isLegalLiabilityInsured(opts.liabilityLimitBand)) {
      return false;
    }
    if (field.key === "excessWorkerToWorker") {
      return true;
    }
    const selectedLimit = resolveLiabilityLimitMillions(opts.liabilityLimitBand);
    if (
      field.liabilityLimitMillions &&
      selectedLimit !== field.liabilityLimitMillions
    ) {
      return false;
    }
  }

  if (!field.band) return true;

  const band = resolveContractValueBand(opts.contractWorksSumInsured);
  if (!band) return false;
  return field.band === band;
}

export function visibleExcessFields(opts: {
  contractWorksSumInsured?: unknown;
  liabilityLimitBand?: unknown;
  group?: ExcessGroup;
}): ExcessFieldConfig[] {
  return EXCESS_FIELDS.filter((field) => {
    if (opts.group && field.group !== opts.group) return false;
    return isExcessFieldVisible(field, opts);
  });
}

export type ExcessFieldBand = {
  band?: ContractValueBand;
  fields: ExcessFieldConfig[];
};

/** Group fields in order, inserting band headings when `band` changes. */
export function groupExcessFieldsByBand(
  fields: ExcessFieldConfig[],
): ExcessFieldBand[] {
  const groups: ExcessFieldBand[] = [];

  for (const field of fields) {
    const last = groups[groups.length - 1];
    if (last && last.band === field.band) {
      last.fields.push(field);
    } else {
      groups.push({ band: field.band, fields: [field] });
    }
  }

  return groups;
}

/** Strip $ / commas / wording so the form stores a bare number. */
export function normalizeExcessValue(value: string | undefined): string {
  if (value == null) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^n\/a$/i.test(trimmed)) return "N/A";
  const match = trimmed.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match?.[0] ?? "";
}

function isLegacyExcessEmpty(value: string | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^n\/a$/i.test(trimmed);
}

function relocateExcessBandPairs(
  excesses: CarExcesses,
  pairs: ReadonlyArray<readonly [ExcessFieldKey, ExcessFieldKey]>,
  band: ContractValueBand | null,
): CarExcesses {
  if (!band) return excesses;

  const result = { ...excesses };
  for (const [upTo2m, over2m] of pairs) {
    const [source, target] =
      band === "from2mTo5m" ? [upTo2m, over2m] : [over2m, upTo2m];
    if (!result[target] && result[source]) {
      result[target] = result[source];
    }
  }
  return result;
}

/** Copy band-specific excess values into the bands matching policy amounts. */
export function relocateExcessesToActiveBand(
  excesses: CarExcesses,
  context?: unknown | ExcessBandContext,
): CarExcesses {
  const { contractWorksSumInsured, liabilityLimitBand } =
    normalizeExcessBandContext(context);
  let result = relocateExcessBandPairs(
    excesses,
    PERILS_BAND_EXCESS_PAIRS,
    resolvePerilsStorageBand(liabilityLimitBand),
  );
  result = relocateExcessBandPairs(
    result,
    LIABILITY_BAND_EXCESS_PAIRS,
    resolveContractValueBand(contractWorksSumInsured),
  );
  return result;
}

/** Upgrade legacy excessSection1A-style keys when loading stored JSON. */
export function migrateLegacyExcessKeys(
  excesses: Record<string, string | undefined> | null | undefined,
): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(excesses ?? {})) {
    if (value != null) raw[key] = value;
  }
  for (const [oldKey, newKey] of Object.entries(LEGACY_EXCESS_KEY)) {
    const legacy = raw[oldKey];
    if (isLegacyExcessEmpty(legacy)) continue;
    if (isLegacyExcessEmpty(raw[newKey])) {
      raw[newKey] = legacy!;
    }
    delete raw[oldKey];
  }
  return raw;
}

export function normalizeExcesses(
  excesses: CarExcesses | Record<string, string | undefined>,
  context?: unknown | ExcessBandContext,
): CarExcesses {
  const migrated = migrateLegacyExcessKeys(excesses);
  const numeric = Object.fromEntries(
    EXCESS_FIELDS.map(({ key }) => [key, normalizeExcessValue(migrated[key])]),
  ) as Pick<CarExcesses, ExcessFieldKey>;

  const normalized: CarExcesses = {
    ...numeric,
    excessAdditionalNotes: migrated.excessAdditionalNotes ?? "",
    excessLegalLiabilityAdditionalNotes:
      migrated.excessLegalLiabilityAdditionalNotes ?? "",
  };

  const bandContext = normalizeExcessBandContext(context);
  const hasBandInput =
    bandContext.contractWorksSumInsured != null ||
    bandContext.liabilityLimitBand != null;
  return hasBandInput
    ? relocateExcessesToActiveBand(normalized, bandContext)
    : normalized;
}

/** Build flat defaultExcesses from PolicyCARExcessDefault catalogue rows. */
export function defaultExcessesFromCatalogue(
  rows: { policyCarExcessDefaultId: number; excess: string }[],
): Omit<CarExcesses, ExcessNoteFieldKey> {
  const result = Object.fromEntries(
    EXCESS_FIELDS.map(({ key }) => [key, ""]),
  ) as Record<ExcessFieldKey, string>;

  for (const row of rows) {
    const key = EXCESS_DEFAULT_FIELD_BY_ID[row.policyCarExcessDefaultId];
    if (!key) continue;
    result[key] = normalizeExcessValue(row.excess);
  }

  return result;
}
