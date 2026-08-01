import { isDigitSearchQuery } from "~/lib/services/shared/list-query";

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function fieldMatches(value: string, query: string) {
  const q = query.trim();
  if (!q || !value) return false;
  const lower = q.toLowerCase();
  if (value.toLowerCase().includes(lower)) return true;
  // Only strip formatting for pure numeric queries (e.g. phone / ABN).
  if (isDigitSearchQuery(q)) {
    const digits = q.replace(/\D/g, "");
    if (digits.length > 0 && value.replace(/\D/g, "").includes(digits)) {
      return true;
    }
  }
  return false;
}
