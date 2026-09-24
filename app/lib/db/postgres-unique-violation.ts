/** Postgres unique_violation (23505) helpers for policy / series indexes. */

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (error as { code?: unknown }).code === "23505";
}

/** Case-insensitive policy_number unique index. */
export function isPolicyNumberConflict(error: unknown): boolean {
  if (!isUniqueViolation(error)) return false;
  const { constraint_name, message } = error as {
    constraint_name?: unknown;
    message?: unknown;
  };
  return (
    String(constraint_name ?? "").includes("policy_number") ||
    String(message ?? "").includes("policy_policy_number_uidx")
  );
}

/** Case-insensitive policy_series.series_number unique index. */
export function isSeriesNumberConflict(error: unknown): boolean {
  if (!isUniqueViolation(error)) return false;
  const { constraint_name, message } = error as {
    constraint_name?: unknown;
    message?: unknown;
  };
  return (
    String(constraint_name ?? "").includes("series_number") ||
    String(message ?? "").includes("policy_series_number_uidx")
  );
}
