import type { Policy } from "~/lib/db/types";

/** Client-facing policy label (series number). */
export function policyDisplayNumber(
  policy: Pick<Policy, "seriesNumber" | "policyNumber">,
): string {
  const series = policy.seriesNumber?.trim();
  if (series) return series;
  return policy.policyNumber?.trim() || "";
}
