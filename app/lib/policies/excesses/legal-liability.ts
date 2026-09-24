import type { CarExcesses } from "~/lib/db/types";

import {
  contractWorksLimitSyncKey,
  resolveContractValueBand,
} from "./contract-works-band";
import {
  LEGAL_LIABILITY_EXCESS_FIELD_KEYS,
  LIABILITY_LIMIT_NOT_INSURED_BAND_ID,
} from "./field-catalogue";
import type { ContractValueBand, ExcessFieldKey } from "./types";
import { resolveWorkerToWorkerExcess } from "./worker-to-worker";

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

function liabilityLimitExcessKey(
  turnoverBand: ContractValueBand,
  limitMillions: 10 | 20,
): ExcessFieldKey {
  if (turnoverBand === "upTo2m") {
    return limitMillions === 10
      ? "excessUpTo2MLimit10M"
      : "excessUpTo2MLimit20M";
  }
  return limitMillions === 10 ? "excessOver2MLimit10M" : "excessOver2MLimit20M";
}

type LegalLiabilityExcessSlice = Pick<
  CarExcesses,
  | "excessWorkerToWorker"
  | "excessUpTo2MLimit10M"
  | "excessUpTo2MLimit20M"
  | "excessOver2MLimit10M"
  | "excessOver2MLimit20M"
>;

/**
 * Section 2 legal liability excess values from contract works band + limit of liability.
 * Not insured or missing contract works band → worker default only; limit rows N/A.
 */
export function legalLiabilityExcessValuesFor(
  contractWorksSumInsured: unknown,
  liabilityLimitBand: unknown,
  defaults: LegalLiabilityExcessSlice,
  estimatedTurnover?: unknown,
): LegalLiabilityExcessSlice {
  const na = Object.fromEntries(
    LEGAL_LIABILITY_EXCESS_FIELD_KEYS.map((key) => [key, "N/A"]),
  ) as LegalLiabilityExcessSlice;

  if (!isLegalLiabilityInsured(liabilityLimitBand)) {
    return na;
  }

  const limitMillions = resolveLiabilityLimitMillions(liabilityLimitBand);
  const contractWorksBand = resolveContractValueBand(contractWorksSumInsured);
  const workerFromTurnover = resolveWorkerToWorkerExcess(estimatedTurnover);
  const withWorker = {
    ...na,
    excessWorkerToWorker: workerFromTurnover ?? defaults.excessWorkerToWorker,
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
