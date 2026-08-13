/**
 * Premium calculation utilities.
 * Extracted from premium-workings.ts to reduce file size.
 */

import type { PremiumWorkingStep } from "./premium-workings";

/**
 * Round monetary values to 2 decimal places.
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Create a premium working step with optional detail.
 */
export function step(label: string, detail?: string): PremiumWorkingStep {
  return detail ? { label, detail } : { label };
}

/**
 * Format a monetary value as currency string.
 * Re-export from utils for consistency.
 */
export { formatCurrency } from "~/lib/utils";

/**
 * Format a rate as percentage string.
 * Re-export from utils for consistency.
 */
export { formatRate } from "~/lib/utils";

/**
 * Check if a value is approximately zero (within tolerance).
 */
export function isApproximatelyZero(value: number, tolerance = 0.001): boolean {
  return Math.abs(value) < tolerance;
}

/**
 * Calculate percentage of a value.
 */
export function calculatePercentage(value: number, percentage: number): number {
  return roundMoney(value * (percentage / 100));
}

/**
 * Apply GST to a value.
 */
export function applyGst(value: number, gstRate: number): number {
  return roundMoney(value * (1 + gstRate));
}

/**
 * Remove GST from a value.
 */
export function removeGst(value: number, gstRate: number): number {
  return roundMoney(value / (1 + gstRate));
}

/**
 * Compare two monetary values with tolerance for floating point errors.
 */
export function moneyEquals(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Format a number with commas as thousands separators.
 */
export function formatNumberWithCommas(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}