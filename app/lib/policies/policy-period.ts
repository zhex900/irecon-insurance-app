/** Standard CAR policy term: same calendar day, 12 months after inception. */
export const POLICY_TERM_MONTHS = 12;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalIsoDate(isoDate: string): Date | null {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function addCalendarMonths(
  isoDate: string,
  months: number,
): Date | null {
  const date = parseLocalIsoDate(isoDate);
  if (!date) return null;
  date.setMonth(date.getMonth() + months);
  return date;
}

export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function derivePolicyEndDate(dateStart: string): string | null {
  const end = addCalendarMonths(dateStart, POLICY_TERM_MONTHS);
  if (!end) return null;
  return toLocalIsoDate(end);
}
