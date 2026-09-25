import type { CarExcesses } from "~/lib/db/types";

export type ExcessNoteFieldKey =
  "excessAdditionalNotes" | "excessLegalLiabilityAdditionalNotes";

export type ExcessFieldKey = Exclude<keyof CarExcesses, ExcessNoteFieldKey>;

export type ExcessBandContext = {
  /** Section 1 contract works — $2M band for Section 2 limit excess rows. */
  contractWorksSumInsured?: unknown;
  /** Section 2 limit of liability ($10m / $20m / not insured). */
  liabilityLimitBand?: unknown;
};

export type ExcessGroup = "contractWorks" | "legalLiability";

export type ContractValueBand = "upTo2m" | "from2mTo5m";

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

export type ActiveBandExcessAmounts = {
  minorPerils: string;
  majorPerils: string;
  limit10M: string;
  limit20M: string;
};

export type ExcessFieldBand = {
  band?: ContractValueBand;
  fields: ExcessFieldConfig[];
};
