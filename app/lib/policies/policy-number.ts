/** Fixed prefix for all CAR policy numbers (generation + UI). */
export const POLICY_NUMBER_PREFIX = "ATCCWI";

/** User-facing message when a policy number is already allocated. */
export const POLICY_NUMBER_TAKEN_MESSAGE =
  "This policy number is already in use";

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

/** Auto-allocate from `policy_number_seq` (not the UUID primary key). */
export function formatPolicyNumberFromSeq(seq: number): string {
  return composePolicyNumber(String(seq).padStart(4, "0"));
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
  return composePolicyNumber(trimmed);
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
  const policyNumber = composePolicyNumber(trimmed);
  const suffix = policyNumberSuffix(policyNumber);
  if (suffix.length === 0) {
    return { ok: false, message: "Enter the policy number after the prefix" };
  }
  if (!/^\d+$/.test(suffix)) {
    return { ok: false, message: "Policy number must be digits only" };
  }
  return { ok: true, policyNumber };
}
