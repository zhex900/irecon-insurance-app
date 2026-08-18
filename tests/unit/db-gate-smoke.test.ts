import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

import { QueryGate, wrapPostgresWithGate } from "~/lib/db/query-gate";
import { appFeatureFlag } from "~/lib/db/schema";

const url =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function hasMigrationSeedData() {
  try {
    const sql = postgres(url, { max: 1, connect_timeout: 2 });
    const db = drizzle(sql);
    const [flag] = await db
      .select({ featureKey: appFeatureFlag.featureKey })
      .from(appFeatureFlag)
      .where(eq(appFeatureFlag.featureKey, "prices"))
      .limit(1);
    await sql.end({ timeout: 1 });
    return flag?.featureKey ?? null;
  } catch {
    return null;
  }
}

const featureKey = await hasMigrationSeedData();
const describeDb = featureKey ? describe : describe.skip;

describeDb("gated drizzle against local postgres", () => {
  it("runs repeated feature-flag-style queries", async () => {
    const base = postgres(url, { max: 5, prepare: false });
    const gate = new QueryGate(3);
    const sql = wrapPostgresWithGate(base, gate);
    const db = drizzle(sql);
    const key = featureKey!;

    for (let i = 0; i < 30; i++) {
      const [row] = await db
        .select()
        .from(appFeatureFlag)
        .where(eq(appFeatureFlag.featureKey, key))
        .limit(1);
      expect(row?.featureKey).toBe(key);
    }

    await base.end({ timeout: 0 });
  });
});

if (!featureKey) {
  describe.skip("gated drizzle against local postgres (DATABASE_URL unreachable)", () => {
    it("skipped", () => {
      expect(true).toBe(true);
    });
  });
}
