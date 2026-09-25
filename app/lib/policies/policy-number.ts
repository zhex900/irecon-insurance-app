/** Fixed prefix for all CAR policy numbers (generation + UI). */
export const POLICY_NUMBER_PREFIX = "ATCCWI";

/**
 * Numeric suffix width (legacy MSSQL `ATCCW{0:D4}` / `_archive` export: ATCCWI####).
 * Total displayed length is always {@link POLICY_NUMBER_PREFIX}.length + this value (10).
 */
export const POLICY_NUMBER_SUFFIX_LENGTH = 4;

/** User-facing message when a policy or series number is already allocated. */
export const POLICY_NUMBER_TAKEN_MESSAGE =
  "This policy number is already in use";

const POLICY_NUMBER_SUFFIX_TOO_LONG_MESSAGE = `Policy number must be ${POLICY_NUMBER_SUFFIX_LENGTH} digits after the prefix`;

/** Keep digits only (suffix after the fixed prefix). */
export function sanitizePolicyNumberSuffix(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Editable suffix only — strips {@link POLICY_NUMBER_PREFIX} when present.
 */
export function policyNumberSuffix(policyNumber: string): string {
  const trimmed = policyNumber.trim();
  if (trimmed.toUpperCase().startsWith(POLICY_NUMBER_PREFIX)) {
    return sanitizePolicyNumberSuffix(
      trimmed.slice(POLICY_NUMBER_PREFIX.length),
    );
  }
  return sanitizePolicyNumberSuffix(trimmed);
}

/**
 * Build a full policy number from a suffix (or pasted full number).
 * Always uses {@link POLICY_NUMBER_PREFIX}; suffix is digits only.
 */
export function composePolicyNumber(suffix: string): string {
  const clean = policyNumberSuffix(suffix);
  return `${POLICY_NUMBER_PREFIX}${clean}`;
}

/** Canonical ATCCWI#### for persistence, allocation, and display after save. */
export function canonicalPolicyNumber(value: string): string {
  const suffix = policyNumberSuffix(value);
  if (!suffix) return composePolicyNumber("");
  return composePolicyNumber(suffix.padStart(POLICY_NUMBER_SUFFIX_LENGTH, "0"));
}

/** Increment the numeric policy suffix while preserving fixed legacy width. */
export function incrementPolicyNumber(policyNumber: string): string {
  const suffix = policyNumberSuffix(policyNumber);
  if (!suffix) return canonicalPolicyNumber("1");
  const next = Number(suffix) + 1;
  if (next > 10 ** POLICY_NUMBER_SUFFIX_LENGTH - 1) {
    throw new Error("Policy number sequence exhausted");
  }
  return canonicalPolicyNumber(String(next));
}

/** Auto-allocate from `policy_number_seq` (not the UUID primary key). */
export function formatPolicyNumberFromSeq(seq: number): string {
  if (seq < 0 || seq > 10 ** POLICY_NUMBER_SUFFIX_LENGTH - 1) {
    throw new Error("Policy number sequence out of range");
  }
  return canonicalPolicyNumber(String(seq));
}

/**
 * Policy number to persist for a save. Terminal (Taken / Not taken) policies
 * keep the number they were bound with; blank input keeps the current number.
 */
export function resolvePolicyNumberForSave(
  currentPolicyNumber: string,
  submitted: string | undefined,
  locked: boolean,
): string {
  if (locked) return currentPolicyNumber;
  const trimmed = submitted?.trim();
  if (!trimmed) return currentPolicyNumber;
  return canonicalPolicyNumber(trimmed);
}

/**
 * Normalize and validate shape of a policy number for save.
 * Uniqueness is checked separately against the database.
 */
export function validatePolicyNumberInput(
  value: string | undefined,
): { ok: true; policyNumber: string } | { ok: false; message: string } {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return { ok: false, message: "Policy number is required" };
  }
  const suffix = policyNumberSuffix(trimmed);
  if (suffix.length === 0) {
    return { ok: false, message: "Enter the policy number after the prefix" };
  }
  if (!/^\d+$/.test(suffix)) {
    return { ok: false, message: "Policy number must be digits only" };
  }
  if (suffix.length > POLICY_NUMBER_SUFFIX_LENGTH) {
    return { ok: false, message: POLICY_NUMBER_SUFFIX_TOO_LONG_MESSAGE };
  }
  const policyNumber = canonicalPolicyNumber(trimmed);
  return { ok: true, policyNumber };
}

/** Validate client-facing series number (same shape as policy numbers). */
export function validateSeriesNumberInput(
  value: string | undefined,
): { ok: true; seriesNumber: string } | { ok: false; message: string } {
  const result = validatePolicyNumberInput(value);
  if (!result.ok) return result;
  return { ok: true, seriesNumber: result.policyNumber };
}

/** Series number to persist when the broker edits the field. */
export function resolveSeriesNumberForSave(
  currentSeriesNumber: string,
  submitted: string | undefined,
  locked: boolean,
): string {
  return resolvePolicyNumberForSave(currentSeriesNumber, submitted, locked);
}

/**
 * Legacy renewal term suffixes group under one client-facing series base.
 * Matches MSSQL import dedupe shapes (year, year-month, full inception date).
 * Example: ATCCWI0487-2024-06-15 → ATCCWI0487
 */
export function normalizeLegacySeriesBase(policyNumber: string): string {
  let trimmed = policyNumber.trim().toUpperCase();
  const legacySuffixes = [
    /^ATCCWI\d+-(?:19|20)\d{2}-\d{2}-\d{2}$/,
    /^ATCCWI\d+-(?:19|20)\d{2}-\d{2}$/,
    /^ATCCWI\d+-(?:19|20)\d{2}$/,
  ] as const;
  for (const pattern of legacySuffixes) {
    if (!pattern.test(trimmed)) continue;
    trimmed = trimmed.replace(/-(?:19|20)\d{2}(?:-\d{2}){0,2}$/, "");
    break;
  }
  return canonicalPolicyNumber(trimmed);
}
