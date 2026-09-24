import { EXCESS_CONTRACT_VALUE_BAND_THRESHOLD } from "~/constants";
import { stripAmountCommas } from "~/lib/amount-input";

import type { ContractValueBand } from "./types";

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

/**
 * Which Major / Minor Perils row set applies from Section 1 contract works sum insured.
 * ≤ $2,000,000 → up-to band; above → over-$2M band.
 */
export function resolvePerilsStorageBand(
  contractWorksSumInsured: unknown,
): ContractValueBand | null {
  return resolveContractValueBand(contractWorksSumInsured);
}

/** Stable key for detecting contract-value band changes in the form. */
export function contractWorksLimitSyncKey(value: unknown): string {
  const band = resolveContractValueBand(value);
  const raw = stripAmountCommas(value);
  if (raw === "" || raw == null) return "none:";
  const numeric = typeof raw === "number" ? raw : Number(raw);
  return `${band ?? "none"}:${Number.isFinite(numeric) ? numeric : raw}`;
}
