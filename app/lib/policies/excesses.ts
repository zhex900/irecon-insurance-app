import { stripAmountCommas } from "~/lib/amount-input";
import type { CarExcesses } from "~/lib/db/types";

export type ExcessFieldKey = Exclude<
  keyof CarExcesses,
  "excessAdditionalNotes"
>;

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

const BAND_EXCESS_PAIRS: ReadonlyArray<
  readonly [ExcessFieldKey, ExcessFieldKey]
> = [
  ["excessUpTo2MMinorPerils", "excessOver2MMinorPerils"],
  ["excessUpTo2MMajorPerils", "excessOver2MMajorPerils"],
  ["excessUpTo2MLimit10M", "excessOver2MLimit10M"],
  ["excessUpTo2MLimit20M", "excessOver2MLimit20M"],
];

export type ExcessGroup = "contractWorks" | "legalLiability";

export type ContractValueBand = "upTo2m" | "from2mTo5m";

export const CONTRACT_VALUE_BAND_LABEL: Record<ContractValueBand, string> = {
  upTo2m: "Contract Value up to $2,000,000",
  from2mTo5m: "Contract Value over $2,000,001",
};

export type ExcessFieldConfig = {
  key: ExcessFieldKey;
  group: ExcessGroup;
  label: string;
  /** Shown under the input (e.g. "each and every loss"). */
  description?: string;
  /** Optional band heading used to group related fields. */
  band?: string;
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
    key: "excessUpTo2MMinorPerils",
    group: "contractWorks",
    label: "Minor Perils",
    description: "each and every loss",
    band: CONTRACT_VALUE_BAND_LABEL.upTo2m,
  },
  {
    key: "excessUpTo2MMajorPerils",
    group: "contractWorks",
    label: "Major Perils",
    description: "each and every loss",
    band: CONTRACT_VALUE_BAND_LABEL.upTo2m,
  },
  {
    key: "excessOver2MMinorPerils",
    group: "contractWorks",
    label: "Minor Perils",
    description: "each and every loss",
    band: CONTRACT_VALUE_BAND_LABEL.from2mTo5m,
  },
  {
    key: "excessOver2MMajorPerils",
    group: "contractWorks",
    label: "Major Perils",
    description: "each and every loss",
    band: CONTRACT_VALUE_BAND_LABEL.from2mTo5m,
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
    band: CONTRACT_VALUE_BAND_LABEL.upTo2m,
    liabilityLimitMillions: 10,
  },
  {
    key: "excessUpTo2MLimit20M",
    group: "legalLiability",
    label: "$20M Limit of Liability",
    description: "each and every occurrence",
    band: CONTRACT_VALUE_BAND_LABEL.upTo2m,
    liabilityLimitMillions: 20,
  },
  {
    key: "excessOver2MLimit10M",
    group: "legalLiability",
    label: "$10M Limit of Liability",
    description: "each and every occurrence",
    band: CONTRACT_VALUE_BAND_LABEL.from2mTo5m,
    liabilityLimitMillions: 10,
  },
  {
    key: "excessOver2MLimit20M",
    group: "legalLiability",
    label: "$20M Limit of Liability",
    description: "each and every occurrence",
    band: CONTRACT_VALUE_BAND_LABEL.from2mTo5m,
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
  if (!Number.isFinite(value) || value < 0) return null;
  if (value <= 2_000_000) return "upTo2m";
  return "from2mTo5m";
}

/** Active band heading for PDFs / merge fields (empty when turnover unknown). */
export function contractValueBandLabel(estimatedTurnover: unknown): string {
  const band = resolveContractValueBand(estimatedTurnover);
  return band ? CONTRACT_VALUE_BAND_LABEL[band] : "";
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
  estimatedTurnover: unknown,
): ActiveBandExcessAmounts {
  const empty: ActiveBandExcessAmounts = {
    minorPerils: "",
    majorPerils: "",
    limit10M: "",
    limit20M: "",
  };
  const band = resolveContractValueBand(estimatedTurnover);
  if (!band || !excesses) return empty;

  if (band === "upTo2m") {
    return {
      minorPerils: excesses.excessUpTo2MMinorPerils ?? "",
      majorPerils: excesses.excessUpTo2MMajorPerils ?? "",
      limit10M: excesses.excessUpTo2MLimit10M ?? "",
      limit20M: excesses.excessUpTo2MLimit20M ?? "",
    };
  }

  return {
    minorPerils: excesses.excessOver2MMinorPerils ?? "",
    majorPerils: excesses.excessOver2MMajorPerils ?? "",
    limit10M: excesses.excessOver2MLimit10M ?? "",
    limit20M: excesses.excessOver2MLimit20M ?? "",
  };
}

export function isExcessFieldVisible(
  field: ExcessFieldConfig,
  opts: {
    estimatedTurnover: unknown;
    liabilityLimitBand?: unknown;
  },
): boolean {
  if (!field.band) return true;

  const band = resolveContractValueBand(opts.estimatedTurnover);
  if (!band) return false;
  // Show the whole band (e.g. Minor+Major, or $10m+$20m) — same theory as
  // Section 1: only the matching estimated-turnover band appears.
  return field.band === CONTRACT_VALUE_BAND_LABEL[band];
}

export function visibleExcessFields(opts: {
  estimatedTurnover: unknown;
  liabilityLimitBand?: unknown;
  group?: ExcessGroup;
}): ExcessFieldConfig[] {
  return EXCESS_FIELDS.filter((field) => {
    if (opts.group && field.group !== opts.group) return false;
    return isExcessFieldVisible(field, opts);
  });
}

export type ExcessFieldBand = {
  band?: string;
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
  const match = trimmed.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match?.[0] ?? "";
}

function isLegacyExcessEmpty(value: string | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^n\/a$/i.test(trimmed);
}

/** Copy band-specific excess values into the band matching estimated turnover. */
export function relocateExcessesToActiveBand(
  excesses: CarExcesses,
  estimatedTurnover: unknown,
): CarExcesses {
  const band = resolveContractValueBand(estimatedTurnover);
  if (!band) return excesses;

  const result = { ...excesses };
  for (const [upTo2m, over2m] of BAND_EXCESS_PAIRS) {
    const [source, target] =
      band === "from2mTo5m" ? [upTo2m, over2m] : [over2m, upTo2m];
    if (!result[target] && result[source]) {
      result[target] = result[source];
    }
  }
  return result;
}

/** Upgrade legacy excessSection1A-style keys when loading stored JSON. */
export function migrateLegacyExcessKeys(
  excesses: Record<string, string | undefined> | null | undefined,
): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(excesses ?? {})) {
    if (value != null && !isLegacyExcessEmpty(value)) raw[key] = value;
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
  estimatedTurnover?: unknown,
): CarExcesses {
  const migrated = migrateLegacyExcessKeys(excesses);
  const numeric = Object.fromEntries(
    EXCESS_FIELDS.map(({ key }) => [key, normalizeExcessValue(migrated[key])]),
  ) as Pick<CarExcesses, ExcessFieldKey>;

  const normalized: CarExcesses = {
    ...numeric,
    excessAdditionalNotes: migrated.excessAdditionalNotes ?? "",
  };

  return estimatedTurnover == null
    ? normalized
    : relocateExcessesToActiveBand(normalized, estimatedTurnover);
}

/** Build flat defaultExcesses from PolicyCARExcessDefault catalogue rows. */
export function defaultExcessesFromCatalogue(
  rows: { policyCarExcessDefaultId: number; excess: string }[],
): Omit<CarExcesses, "excessAdditionalNotes"> {
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
