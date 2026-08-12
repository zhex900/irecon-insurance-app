import { getDb } from "~/lib/db/client";
import { state } from "~/lib/db/price-schema";

export function num(value: string | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

export function strNum(value: number | null | undefined): string {
  if (value == null) return "0";
  return String(value);
}

export const POLICY_TYPE_CAR = 1;

/** Load every state code → id once, for batches that would otherwise query per row. */
export async function loadStateIdByCode(
  dbOrTx: { select: ReturnType<typeof getDb>["select"] } = getDb(),
): Promise<Map<string, number>> {
  const rows = await dbOrTx.select().from(state);
  return new Map(rows.map((row) => [row.code.toUpperCase(), row.stateId]));
}

/** Look up a preloaded state map, throwing the same error shape as the old per-row lookup. */
export function requireStateId(
  stateIdMap: Map<string, number>,
  code: string,
): number {
  const stateId = stateIdMap.get(code.toUpperCase());
  if (stateId == null) throw new Error(`Unknown state code: ${code}`);
  return stateId;
}

export function requireDate(dateStart: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStart)) {
    throw new Error("Effective date must be YYYY-MM-DD");
  }
  return dateStart;
}
