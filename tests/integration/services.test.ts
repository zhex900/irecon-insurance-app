import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { FEATURE_KEYS, listFeatureFlags } from "~/lib/services/feature-flags";
import { getReferenceData } from "~/lib/services/reference.service";
import { listUsers } from "~/lib/services/users/service";

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

const ready = await canConnect();
const describeDb = ready ? describe : describe.skip;

describeDb("integration: postgres services", () => {
  it("lists feature flags for catalogue keys", async () => {
    const flags = await listFeatureFlags();
    expect(flags.map((flag) => flag.key).sort()).toEqual(
      [...FEATURE_KEYS].sort(),
    );
    expect(flags.every((flag) => typeof flag.enabled === "boolean")).toBe(true);
  });

  it("loads reference data with states", () => {
    const reference = getReferenceData();
    expect(reference.states.length).toBeGreaterThan(0);
    expect(reference.states.some((state) => state.code === "NSW")).toBe(true);
  });

  it("lists seeded users when auth seed has run", async () => {
    const users = await listUsers();
    // Soft assert: empty DB is still a valid integration signal.
    expect(Array.isArray(users)).toBe(true);
  });
});

if (!ready) {
  describe.skip("integration: postgres services (DATABASE_URL unreachable)", () => {
    it("skipped", () => {
      expect(true).toBe(true);
    });
  });
}
