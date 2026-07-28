/** Keep digits and at most one decimal point; strip commas and other junk. */
export function sanitizeAmountInput(value: string): string {
  const stripped = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const [intPart = "", ...rest] = stripped.split(".");
  if (rest.length === 0) return intPart;
  return `${intPart}.${rest.join("")}`;
}

/** True when the stored amount is numerically zero (not empty). */
export function isZeroAmount(
  value: string | number | null | undefined,
): boolean {
  if (value == null || value === "") return false;
  if (typeof value === "number") return value === 0;
  const raw = sanitizeAmountInput(String(value));
  if (!raw) return false;
  return Number(raw) === 0;
}

/** Format a stored amount with thousands separators (en-AU style commas). */
export function formatAmountInput(
  value: string | number | null | undefined,
): string {
  if (value == null || value === "") return "";
  const raw = sanitizeAmountInput(String(value));
  if (!raw) return "";
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPart = "", decPart] = unsigned.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formatted =
    decPart != null && decPart !== ""
      ? `${withCommas}.${decPart}`
      : unsigned.endsWith(".")
        ? `${withCommas}.`
        : withCommas;
  return negative ? `-${formatted}` : formatted;
}

/**
 * Map caret through comma reformat: keep the same count of digits/decimal
 * markers before the caret so mid-number edits don't jump to the end.
 */
export function mapAmountCaret(
  valueBeforeFormat: string,
  caret: number,
  formatted: string,
): number {
  const clamped = Math.max(0, Math.min(caret, valueBeforeFormat.length));
  const significant = valueBeforeFormat
    .slice(0, clamped)
    .replace(/[^\d.]/g, "");
  if (significant.length === 0) return 0;

  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/[\d.]/.test(formatted[i]!)) {
      seen += 1;
      if (seen === significant.length) return i + 1;
    }
  }
  return formatted.length;
}

/** Strip commas before numeric coercion / validation. */
export function stripAmountCommas(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/,/g, "").trim();
  return value;
}
