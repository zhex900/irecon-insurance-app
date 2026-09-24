/** Badge label for term >= 1; first term (0) has no badge. */
export function policySeriesTermBadgeLabel(seriesTerm: number): string | null {
  if (!Number.isFinite(seriesTerm) || seriesTerm < 1) return null;
  return `#${Math.trunc(seriesTerm)}`;
}

/** Plain text for search / logs: ATCCWI1039 or ATCCWI1039#1 */
export function formatPolicySeriesReference(
  seriesNumber: string,
  seriesTerm: number,
): string {
  const base = seriesNumber.trim();
  const badge = policySeriesTermBadgeLabel(seriesTerm);
  return badge ? `${base}${badge}` : base;
}

export type ParsedPolicySeriesSearch =
  | { kind: "text"; query: string }
  | { kind: "series_term"; seriesNumber: string; seriesTerm: number };

/** Parse `ATCCWI1039#1` (optional whitespace before `#`). */
export function parsePolicySeriesSearch(raw: string): ParsedPolicySeriesSearch {
  const query = raw.trim();
  if (!query) return { kind: "text", query: "" };
  const match = query.match(/^(.+?)\s*#(\d+)$/);
  if (!match) return { kind: "text", query };
  const seriesNumber = match[1]!.trim();
  const seriesTerm = Number(match[2]);
  if (!seriesNumber || !Number.isInteger(seriesTerm) || seriesTerm < 0) {
    return { kind: "text", query };
  }
  return { kind: "series_term", seriesNumber, seriesTerm };
}
