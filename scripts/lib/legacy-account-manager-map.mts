/**
 * Map legacy AccountManager.Code → Postgres account_manager_id.
 * Matches seeded IDs from supabase/migrations/20260812100000_account_manager.sql
 */
const CODE_TO_ID: Record<string, number> = {
  ".NA": 1,
  Loretta: 1,
  Justin: 2,
  Lesley: 3,
  Renee: 4,
  Robyn: 5,
  Tracey: 6,
};

export function accountManagerIdForCode(
  code: string | null | undefined,
): number {
  const normalized = (code ?? ".NA").trim();
  return CODE_TO_ID[normalized] ?? 1;
}

export function seededAccountManagerId(
  abbrev: string,
  fullName: string,
): number {
  const key = abbrev.trim();
  if (key in CODE_TO_ID) return CODE_TO_ID[key]!;
  if (fullName.toLowerCase().includes("loretta")) return 1;
  return 1;
}
