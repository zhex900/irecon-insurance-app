/** Words that stay lowercase in Title Case (unless first in a segment). */
const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "the",
  "to",
  "via",
  "vs",
]);

function titleCaseWord(word: string, forceCapital: boolean): string {
  if (word === "&") return "&";

  const lower = word.toLowerCase();
  if (!forceCapital && SMALL_WORDS.has(lower)) return lower;

  return lower.replace(/^[a-zà-öø-ÿ]/, (char) => char.toUpperCase());
}

function titleCaseSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) return segment;

  const leading = segment.match(/^\s*/)?.[0] ?? "";
  const trailing = segment.match(/\s*$/)?.[0] ?? "";
  const words = trimmed.split(/\s+/);

  const cased = words
    .map((word, index) => titleCaseWord(word, index === 0))
    .join(" ");

  return `${leading}${cased}${trailing}`;
}

/**
 * Display Title Case for document template names.
 * Source strings are often ALL CAPS; UI should never show that.
 */
export function formatDocumentTemplateTitle(title: string): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (!normalized) return normalized;

  return normalized
    .split(/(—|–)/)
    .map((part) =>
      part === "—" || part === "–" ? part : titleCaseSegment(part),
    )
    .join("");
}
