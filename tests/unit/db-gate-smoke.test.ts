import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

import { QueryGate, wrapPostgresWithGate } from "~/lib/db/query-gate";
import { appUser } from "~/lib/db/schema";

const url =
  process.env.DATABASE_URL?.trim() ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

describe("gated drizzle against local postgres", () => {
  it("runs repeated getUser-style queries", async () => {
    const base = postgres(url, { max: 5, prepare: false });
    const gate = new QueryGate(3);
    const sql = wrapPostgresWithGate(base, gate);
    const db = drizzle(sql);
    const id = "b81796f2-03ef-465b-9979-d5c99ee53a6c";

    for (let i = 0; i < 30; i++) {
      const [row] = await db
        .select()
        .from(appUser)
        .where(eq(appUser.userId, id))
        .limit(1);
      expect(row?.userId).toBe(id);
    }

    await base.end({ timeout: 0 });
  });
});
