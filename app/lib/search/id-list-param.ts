/** Parse comma-separated positive int IDs from a URL search param. */
export function parseIdListParam(value: string | null): number[] {
  if (!value?.trim()) return [];
  const ids = value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
}

export function formatIdListParam(ids: number[]): string | null {
  if (ids.length === 0) return null;
  return ids.join(",");
}
