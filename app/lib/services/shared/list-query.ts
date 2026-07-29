import { type PaginationParams, clampPageSize } from "~/lib/pagination";

export function likePattern(q: string) {
  return `%${q.replace(/[%_\\]/g, "\\$&")}%`;
}

/** Digits only (for ABN / phone normalized compare). */
export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * True when the query is numeric search (digits + phone/ABN formatting).
 * Letter+digit queries like "w018" must not match via stripped digits alone.
 */
export function isDigitSearchQuery(q: string) {
  const trimmed = q.trim();
  if (!trimmed) return false;
  const digits = digitsOnly(trimmed);
  if (digits.length === 0) return false;
  return digits === trimmed.replace(/[\s\-()+.]/g, "");
}

export function resolvePage(input: {
  limit?: number;
  offset?: number;
  pageSize?: number;
}): PaginationParams {
  const pageSize = clampPageSize(input.limit ?? input.pageSize ?? 25);
  const offset = Math.max(0, input.offset ?? 0);
  const page = Math.floor(offset / pageSize) + 1;
  return { page, pageSize, limit: pageSize, offset };
}
