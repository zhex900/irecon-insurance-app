import type { ExcessFieldConfig, ExcessFieldKey } from "./types";

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

export const PERILS_EXCESS_FIELD_KEYS: readonly ExcessFieldKey[] = [
  "excessUpTo2MMinorPerils",
  "excessUpTo2MMajorPerils",
  "excessOver2MMinorPerils",
  "excessOver2MMajorPerils",
];

/** Reference `liabilityLimitBands` id — Section 2 not insured. */
export const LIABILITY_LIMIT_NOT_INSURED_BAND_ID = 3;

export const LEGAL_LIABILITY_EXCESS_FIELD_KEYS: readonly ExcessFieldKey[] = [
  "excessWorkerToWorker",
  "excessUpTo2MLimit10M",
  "excessUpTo2MLimit20M",
  "excessOver2MLimit10M",
  "excessOver2MLimit20M",
];

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
