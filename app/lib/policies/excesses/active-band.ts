import type { CarExcesses } from "~/lib/db/types";

import { normalizeExcessBandContext } from "./band-context";
import {
  resolveContractValueBand,
  resolvePerilsStorageBand,
} from "./contract-works-band";
import {
  isLegalLiabilityInsured,
  resolveLiabilityLimitMillions,
} from "./legal-liability";
import type {
  ActiveBandExcessAmounts,
  ContractValueBand,
  ExcessBandContext,
} from "./types";

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

/**
 * Excess amounts for the turnover-active contract-value band only.
 * Empty strings when estimated turnover does not resolve to a band.
 */
export function activeBandExcessAmounts(
  excesses: BandExcessSlice | null | undefined,
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
  const perilsBand = resolvePerilsStorageBand(contractWorksSumInsured);
  const liabilityBand = resolveContractValueBand(contractWorksSumInsured);
  const limitMillions = resolveLiabilityLimitMillions(liabilityLimitBand);

  const perilsSlice =
    perilsBand != null ? activePerilsBandAmounts(excesses, perilsBand) : null;
  const liabilitySlice =
    isLegalLiabilityInsured(liabilityLimitBand) && liabilityBand != null
      ? activeLiabilityBandAmounts(excesses, liabilityBand)
      : null;

  const limit10M =
    limitMillions === 10 ? (liabilitySlice?.limit10M ?? "N/A") : "N/A";
  const limit20M =
    limitMillions === 20 ? (liabilitySlice?.limit20M ?? "N/A") : "N/A";

  return {
    minorPerils: perilsSlice?.minorPerils ?? "N/A",
    majorPerils: perilsSlice?.majorPerils ?? "N/A",
    limit10M,
    limit20M,
  };
}
