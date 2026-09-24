import type { Policy } from "~/lib/db/types";
import { formatPolicySeriesReference } from "~/lib/policies/policy-series-term";

/** Client-facing series number only (no #term). Prefer {@link PolicySeriesLabel} in UI. */
export function policyDisplayNumber(
  policy: Pick<Policy, "seriesNumber" | "policyNumber">,
): string {
  const series = policy.seriesNumber?.trim();
  if (series) return series;
  return policy.policyNumber?.trim() || "";
}

/** Series + optional #term for titles, audit, and search-oriented text. */
export function policyDisplayReference(
  policy: Pick<Policy, "seriesNumber" | "policyNumber" | "seriesTerm">,
): string {
  const series = policyDisplayNumber(policy);
  return formatPolicySeriesReference(series, policy.seriesTerm ?? 0);
}
