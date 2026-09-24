import type { CarExcesses } from "~/lib/db/types";

import { resolvePerilsStorageBand } from "./contract-works-band";
import { PERILS_EXCESS_FIELD_KEYS } from "./field-catalogue";
import type { ContractValueBand, ExcessFieldKey } from "./types";

type PerilsExcessSlice = Pick<
  CarExcesses,
  | "excessUpTo2MMinorPerils"
  | "excessUpTo2MMajorPerils"
  | "excessOver2MMinorPerils"
  | "excessOver2MMajorPerils"
>;

/**
 * Major / Minor Perils from Section 1 contract works sum insured.
 * Amounts from reference / catalogue defaults ($1k/$1k vs $2.5k/$5k bands).
 */
export function perilsExcessValuesForContractWorks(
  contractWorksSumInsured: unknown,
  defaults: PerilsExcessSlice,
): PerilsExcessSlice {
  const na = Object.fromEntries(
    PERILS_EXCESS_FIELD_KEYS.map((key) => [key, "N/A"]),
  ) as PerilsExcessSlice;

  const band = resolvePerilsStorageBand(contractWorksSumInsured);
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

/** @deprecated Use {@link perilsExcessValuesForContractWorks}. */
export const perilsExcessValuesForLegalLiability =
  perilsExcessValuesForContractWorks;

/** Default Major / Minor Perils amounts for a band (from reference / catalogue). */
export function perilsExcessDefaultsForBand(
  band: ContractValueBand,
  defaults: PerilsExcessSlice,
): {
  minorKey: ExcessFieldKey;
  majorKey: ExcessFieldKey;
  minor: string;
  major: string;
} {
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
