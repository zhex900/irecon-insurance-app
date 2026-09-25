import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

import { POLICY_NUMBER_SUFFIX_MIN } from "~/lib/policies/policy-number";
import { lowestFreePolicyNumberSuffixQuery } from "~/lib/policies/policy-number-sql";

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function canConnect() {
  try {
    const sql = postgres(databaseUrl, { max: 1, connect_timeout: 2 });
    await sql`select 1`;
    await sql.end({ timeout: 1 });
    return true;
  } catch {
    return false;
  }
}

function suffixFromRows(rows: unknown): number | null {
  const list = Array.isArray(rows) ? rows : [];
  const raw = (list[0] as { suffix?: unknown } | undefined)?.suffix;
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const ready = await canConnect();
const ci = process.env.CI === "true" || process.env.CI === "1";
const describeDb = ready ? describe : describe.skip;

describeDb("integration: policy number allocation SQL", () => {
  it("returns a suffix in range for new business (policy + series)", async () => {
    const client = postgres(databaseUrl, { max: 1, prepare: false });
    const db = drizzle(client);
    try {
      const rows = await db.execute(
        lowestFreePolicyNumberSuffixQuery(true, POLICY_NUMBER_SUFFIX_MIN),
      );
      const suffix = suffixFromRows(rows);
      expect(suffix).not.toBeNull();
      expect(suffix).toBeGreaterThanOrEqual(POLICY_NUMBER_SUFFIX_MIN);
      expect(suffix).toBeLessThanOrEqual(9999);
    } finally {
      await client.end({ timeout: 2 });
    }
  });

  it("returns a suffix for renewal-only (policy table)", async () => {
    const client = postgres(databaseUrl, { max: 1, prepare: false });
    const db = drizzle(client);
    try {
      const rows = await db.execute(
        lowestFreePolicyNumberSuffixQuery(false, POLICY_NUMBER_SUFFIX_MIN),
      );
      const suffix = suffixFromRows(rows);
      expect(suffix).not.toBeNull();
      expect(suffix).toBeGreaterThanOrEqual(POLICY_NUMBER_SUFFIX_MIN);
    } finally {
      await client.end({ timeout: 2 });
    }
  });
});

if (!ready && ci) {
  describe("integration: policy number allocation SQL (CI)", () => {
    it("requires a reachable DATABASE_URL (run scripts/ci/supabase-setup.mjs first)", () => {
      throw new Error(
        `DATABASE_URL unreachable in CI: ${databaseUrl.replace(/:[^:@/]+@/, ":***@")}`,
      );
    });
  });
}

if (!ready && !ci) {
  describe.skip("integration: policy number allocation SQL (DATABASE_URL unreachable)", () => {
    it("skipped", () => {
      expect(true).toBe(true);
    });
  });
}
