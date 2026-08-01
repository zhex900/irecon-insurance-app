import {
  digitsOnly,
  isDigitSearchQuery,
} from "~/lib/services/shared/list-query";

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
    const digits = digitsOnly(q);
    if (digits.length > 0 && digitsOnly(value).includes(digits)) {
      return true;
    }
  }
  return false;
}

export type HighlightSegment = { text: string; match: boolean };

/**
 * Split display text into highlight segments.
 * Digit queries map through digit indices so phone/ABN formatting is preserved
 * (no spaces inserted that were not already in `text`).
 */
export function highlightSegments(
  text: string,
  query: string,
): HighlightSegment[] | null {
  const q = query.trim();
  if (!text || !q) return null;

  if (isDigitSearchQuery(q)) {
    const digitQuery = digitsOnly(q);
    const digitIndexes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) >= 48 && text.charCodeAt(i) <= 57) {
        digitIndexes.push(i);
      }
    }
    if (digitIndexes.length >= digitQuery.length) {
      const allDigits = digitIndexes.map((i) => text[i]!).join("");
      const segments: HighlightSegment[] = [];
      let cursor = 0;
      let searchFrom = 0;
      while (searchFrom <= allDigits.length - digitQuery.length) {
        const found = allDigits.indexOf(digitQuery, searchFrom);
        if (found < 0) break;
        const start = digitIndexes[found]!;
        const end = digitIndexes[found + digitQuery.length - 1]! + 1;
        if (start > cursor) {
          segments.push({ text: text.slice(cursor, start), match: false });
        }
        segments.push({ text: text.slice(start, end), match: true });
        cursor = end;
        searchFrom = found + digitQuery.length;
      }
      if (segments.length > 0) {
        if (cursor < text.length) {
          segments.push({ text: text.slice(cursor), match: false });
        }
        return segments;
      }
    }
  }

  let parts: string[];
  try {
    parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  } catch {
    return null;
  }
  if (parts.length <= 1) return null;
  const lower = q.toLowerCase();
  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      match: part.toLowerCase() === lower,
    }));
}
