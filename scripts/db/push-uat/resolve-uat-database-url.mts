import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseEnvFile } from "../../../deployment/lib/pr-env.mjs";
import { repairSupabaseDatabaseUrl } from "../../../deployment/lib/preview-env.mjs";

function loadUatEnvFile(): Record<string, string> {
  try {
    const text = readFileSync(join(process.cwd(), ".env.uat"), "utf8");
    return parseEnvFile(text);
  } catch {
    return {};
  }
}

function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url.replace(/^postgres:\/\//, "postgresql://"));
    return `${parsed.protocol}//${parsed.username}:****@${parsed.host}${parsed.pathname}`;
  } catch {
    return "(unparseable URL)";
  }
}

function assertValidPostgresUrl(label: string, url: string) {
  try {
    const parsed = new URL(url.replace(/^postgres:\/\//, "postgresql://"));
    if (!parsed.hostname) throw new Error("missing hostname");
  } catch {
    throw new Error(
      `${label} is not a valid Postgres URL (${maskDatabaseUrl(url)}). ` +
        "Supabase direct: postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require",
    );
  }
}

/** UAT pooler or direct URL from env, with common Supabase typo repair (missing `@`). */
export function resolveUatDatabaseUrl(): string {
  const uatEnv = loadUatEnvFile();
  const raw =
    process.env.UAT_DATABASE_URL?.trim() ||
    uatEnv.UAT_DATABASE_URL?.trim() ||
    uatEnv.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "Set UAT_DATABASE_URL or DATABASE_URL in .env.uat (or export UAT_DATABASE_URL). See .env.pr.example.",
    );
  }

  const supabaseUrl =
    process.env.UAT_SUPABASE_URL?.trim() ||
    uatEnv.UAT_SUPABASE_URL?.trim() ||
    uatEnv.SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    undefined;
  const url = repairSupabaseDatabaseUrl(raw, supabaseUrl);

  if (/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error(
      "UAT target DATABASE_URL still points at localhost — set UAT DATABASE_URL in .env.uat",
    );
  }

  assertValidPostgresUrl("UAT database URL", url);

  if (url !== raw) {
    console.warn(
      "Repaired UAT database URL (typo: password and host must be separated with @).",
    );
  }

  return url;
}
