import { clsx, type ClassValue } from "clsx";
import { formatDistance, isValid } from "date-fns";
import { enAU } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

/** App-wide calendar timezone — keeps SSR (Workers UTC) and browser output aligned. */
const BUSINESS_TIME_ZONE = "Australia/Sydney";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-AU").format(value);
}

/** Decimal fraction ↔ percent for pricing rates (stored as fractions, shown as %). */
export function rateToPercent(value: number) {
  return (Number(value) || 0) * 100;
}

export function percentToRate(value: number) {
  return (Number(value) || 0) / 100;
}

/** Pricing rates (CW, liability, stamp, ESL, plant, terrorism) — percent, 4 d.p. */
export function formatRate(value: number) {
  return `${new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(rateToPercent(value))}%`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(value);
}

function toValidDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
}

/** Absolute date for tables/labels — en-AU short date in Australia/Sydney. */
export function formatDate(value: string) {
  const date = toValidDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: BUSINESS_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Relative time (e.g. "about 3 hours ago") via date-fns. */
export function formatRelativeTimeAgo(
  isoDate: string,
  now = Date.now(),
): string {
  const date = toValidDate(isoDate);
  if (!date) return "";
  return formatDistance(date, new Date(now), {
    addSuffix: true,
    locale: enAU,
  });
}
