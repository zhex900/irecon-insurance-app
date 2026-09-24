import { describe, expect, it } from "vitest";

import {
  isLocalSupabaseAuthUrl,
  isLocalSupabasePostgresUrl,
  shouldApplyWorkerSupabaseUrl,
} from "~/lib/cloudflare/apply-worker-env.server";

describe("apply-worker-env", () => {
  it("detects local Supabase Postgres", () => {
    expect(
      isLocalSupabasePostgresUrl(
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      ),
    ).toBe(true);
    expect(
      isLocalSupabasePostgresUrl(
        "postgresql://user:pass@db.example.supabase.co:5432/postgres",
      ),
    ).toBe(false);
  });

  it("detects local Supabase Auth API", () => {
    expect(isLocalSupabaseAuthUrl("http://127.0.0.1:54321")).toBe(true);
    expect(
      isLocalSupabaseAuthUrl("https://tjnsygunohylofihoksl.supabase.co"),
    ).toBe(false);
  });

  it("blocks hosted Supabase URL when dev uses local Postgres", () => {
    expect(
      shouldApplyWorkerSupabaseUrl({
        dev: true,
        databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        workerSupabaseUrl: "https://tjnsygunohylofihoksl.supabase.co",
      }),
    ).toBe(false);
    expect(
      shouldApplyWorkerSupabaseUrl({
        dev: true,
        databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        workerSupabaseUrl: "http://127.0.0.1:54321",
      }),
    ).toBe(true);
  });

  it("always applies worker Supabase URL in production", () => {
    expect(
      shouldApplyWorkerSupabaseUrl({
        dev: false,
        databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        workerSupabaseUrl: "https://example.supabase.co",
      }),
    ).toBe(true);
  });
});
