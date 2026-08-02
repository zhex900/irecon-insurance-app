/** Prefer a Premium Breakdown manual override when set (> 0); else Limits SI. */

function asMoneyNumber(value: number | string | null | undefined): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Brokers often leave Limits SI at a placeholder (or 0) and enter the real
 * amount on the Premium line — prefer that override when present.
 */
export function preferPremiumOverride(
  override: number | string | null | undefined,
  sumInsured: number | string | null | undefined,
): number {
  const o = asMoneyNumber(override);
  return o > 0 ? o : asMoneyNumber(sumInsured);
}
