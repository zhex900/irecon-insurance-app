import { eq } from "drizzle-orm";
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

export async function stateIdByCode(code: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ stateId: state.stateId })
    .from(state)
    .where(eq(state.code, code.toUpperCase()))
    .limit(1);
  if (!row) throw new Error(`Unknown state code: ${code}`);
  return row.stateId;
}

export function requireDate(dateStart: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStart)) {
    throw new Error("Effective date must be YYYY-MM-DD");
  }
  return dateStart;
}
