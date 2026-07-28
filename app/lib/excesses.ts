import type { CarExcesses } from "~/lib/db/types";
import { stripAmountCommas } from "~/lib/amount-input";

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
  1: "excessSection1A",
  3: "excessSection1B",
  4: "excessSection1E",
  6: "excessSection1C",
  7: "excessSection1D",
  9: "excessSection2A",
  11: "excessSection2C",
  12: "excessSection2D",
  14: "excessSection2E",
  15: "excessSection2F",
};

export type ExcessGroup = "contractWorks" | "legalLiability";

export type ContractValueBand = "upTo2m" | "from2mTo5m";

export const CONTRACT_VALUE_BAND_LABEL: Record<ContractValueBand, string> = {
  upTo2m: "Contract Value up to $2,000,000",
  from2mTo5m: "Contract Value $2,000,001 to $5,000,000",
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
    key: "excessSection1A",
    group: "contractWorks",
    label: "Named Insureds Construction Plant & Equipment",
    description: "each and every loss",
  },
  {
    key: "excessSection1B",
    group: "contractWorks",
    label: "Minor Perils",
    description: "each and every loss",
    band: CONTRACT_VALUE_BAND_LABEL.upTo2m,
  },
  {
    key: "excessSection1E",
    group: "contractWorks",
    label: "Major Perils",
    description: "each and every loss",
    band: CONTRACT_VALUE_BAND_LABEL.upTo2m,
  },
  {
    key: "excessSection1C",
    group: "contractWorks",
    label: "Minor Perils",
    description: "each and every loss",
    band: CONTRACT_VALUE_BAND_LABEL.from2mTo5m,
  },
  {
    key: "excessSection1D",
    group: "contractWorks",
    label: "Major Perils",
    description: "each and every loss",
    band: CONTRACT_VALUE_BAND_LABEL.from2mTo5m,
  },
  {
    key: "excessSection2A",
    group: "legalLiability",
    label: "Worker to Worker",
    description: "each and every Occurrence",
  },
  {
    key: "excessSection2C",
    group: "legalLiability",
    label: "$10m Limit of Liability",
    description: "each and every Occurrence",
    band: CONTRACT_VALUE_BAND_LABEL.upTo2m,
    liabilityLimitMillions: 10,
  },
  {
    key: "excessSection2D",
    group: "legalLiability",
    label: "$20m Limit of Liability",
    description: "each and every Occurrence",
    band: CONTRACT_VALUE_BAND_LABEL.upTo2m,
    liabilityLimitMillions: 20,
  },
  {
    key: "excessSection2E",
    group: "legalLiability",
    label: "$10m Limit of Liability",
    description: "each and every Occurrence",
    band: CONTRACT_VALUE_BAND_LABEL.from2mTo5m,
    liabilityLimitMillions: 10,
  },
  {
    key: "excessSection2F",
    group: "legalLiability",
    label: "$20m Limit of Liability",
    description: "each and every Occurrence",
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

export function normalizeExcesses(excesses: CarExcesses): CarExcesses {
  const numeric = Object.fromEntries(
    EXCESS_FIELDS.map(({ key }) => [key, normalizeExcessValue(excesses[key])]),
  ) as Pick<CarExcesses, ExcessFieldKey>;

  return {
    ...numeric,
    excessAdditionalNotes: excesses.excessAdditionalNotes ?? "",
  };
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
