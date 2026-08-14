// Shared utilities for autocomplete components

/**
 * Compare two values for equality, handling null/undefined and string conversion.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}
