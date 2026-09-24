import type { CarExcesses } from "~/lib/db/types";

import { normalizeExcessBandContext } from "./band-context";
import {
  resolveContractValueBand,
  resolvePerilsStorageBand,
} from "./contract-works-band";
import type {
  ContractValueBand,
  ExcessBandContext,
  ExcessFieldKey,
} from "./types";

const PERILS_BAND_EXCESS_PAIRS: ReadonlyArray<
  readonly [ExcessFieldKey, ExcessFieldKey]
> = [
  ["excessUpTo2MMinorPerils", "excessOver2MMinorPerils"],
  ["excessUpTo2MMajorPerils", "excessOver2MMajorPerils"],
];

const LIABILITY_BAND_EXCESS_PAIRS: ReadonlyArray<
  readonly [ExcessFieldKey, ExcessFieldKey]
> = [
  ["excessUpTo2MLimit10M", "excessOver2MLimit10M"],
  ["excessUpTo2MLimit20M", "excessOver2MLimit20M"],
];

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
  const { contractWorksSumInsured } = normalizeExcessBandContext(context);
  let result = relocateExcessBandPairs(
    excesses,
    PERILS_BAND_EXCESS_PAIRS,
    resolvePerilsStorageBand(contractWorksSumInsured),
  );
  result = relocateExcessBandPairs(
    result,
    LIABILITY_BAND_EXCESS_PAIRS,
    resolveContractValueBand(contractWorksSumInsured),
  );
  return result;
}
