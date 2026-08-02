import {
  addMonths,
  addWeeks,
  addYears,
  format,
  isValid,
  parseISO,
  startOfDay,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";

export type DateRangeValue = {
  from: string | null;
  to: string | null;
  preset: string | null;
};

export type DateRangePreset = {
  id: string;
  label: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  return isValid(parseISO(value));
}

export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function dateRangeActive(range: DateRangeValue): boolean {
  return Boolean(range.from || range.to || range.preset);
}

export const INCEPTION_PRESETS = [
  { id: "last-week", label: "Last week" },
  { id: "last-month", label: "Last month" },
  { id: "last-6-months", label: "Last 6 months" },
  { id: "last-year", label: "Last year" },
] as const satisfies readonly DateRangePreset[];

export const EXPIRY_PRESETS = [
  { id: "next-week", label: "Next week" },
  { id: "next-month", label: "Next month" },
  { id: "next-6-months", label: "Next 6 months" },
  { id: "next-year", label: "Next year" },
] as const satisfies readonly DateRangePreset[];

export type InceptionPresetId = (typeof INCEPTION_PRESETS)[number]["id"];
export type ExpiryPresetId = (typeof EXPIRY_PRESETS)[number]["id"];

export function rangeForInceptionPreset(
  preset: InceptionPresetId,
  now = new Date(),
): { from: string; to: string } {
  const to = startOfDay(now);
  let from: Date;
  switch (preset) {
    case "last-week":
      from = subWeeks(to, 1);
      break;
    case "last-month":
      from = subMonths(to, 1);
      break;
    case "last-6-months":
      from = subMonths(to, 6);
      break;
    case "last-year":
      from = subYears(to, 1);
      break;
  }
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export function rangeForExpiryPreset(
  preset: ExpiryPresetId,
  now = new Date(),
): { from: string; to: string } {
  const from = startOfDay(now);
  let to: Date;
  switch (preset) {
    case "next-week":
      to = addWeeks(from, 1);
      break;
    case "next-month":
      to = addMonths(from, 1);
      break;
    case "next-6-months":
      to = addMonths(from, 6);
      break;
    case "next-year":
      to = addYears(from, 1);
      break;
  }
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function parsePresetId<T extends string>(
  value: string | null,
  presets: readonly { id: T }[],
): T | null {
  if (!value) return null;
  return presets.some((preset) => preset.id === value) ? (value as T) : null;
}

export function resolveDateRange(input: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  presets: readonly DateRangePreset[];
  rangeForPreset: (preset: string, now?: Date) => { from: string; to: string };
}): DateRangeValue {
  const preset = parsePresetId(
    input.preset ?? null,
    input.presets as readonly { id: string }[],
  );
  if (preset) {
    const range = input.rangeForPreset(preset);
    return { from: range.from, to: range.to, preset };
  }
  const from = isIsoDate(input.from ?? null) ? input.from! : null;
  const to = isIsoDate(input.to ?? null) ? input.to! : null;
  return { from, to, preset: null };
}

export function resolveInceptionRange(input: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
}): DateRangeValue {
  return resolveDateRange({
    ...input,
    presets: INCEPTION_PRESETS,
    rangeForPreset: (preset, now) =>
      rangeForInceptionPreset(preset as InceptionPresetId, now),
  });
}

export function resolveExpiryRange(input: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
}): DateRangeValue {
  return resolveDateRange({
    ...input,
    presets: EXPIRY_PRESETS,
    rangeForPreset: (preset, now) =>
      rangeForExpiryPreset(preset as ExpiryPresetId, now),
  });
}
