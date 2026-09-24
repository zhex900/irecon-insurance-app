#!/usr/bin/env node
/**
 * Replace local Supabase Postgres with a full copy of UAT.
 *
 *   npm run db:copy:uat
 *
 * Reads UAT_DATABASE_URL from `.env.uat` (or DATABASE_URL in that file).
 * Reads local DATABASE_URL from `.env` (must be localhost / 127.0.0.1).
 */
import { join } from "node:path";

import { readEnvFile } from "./lib/pr-env.mjs";
import { copyDatabaseFromUat } from "./lib/uat-data-copy.mjs";
import {
  repairSupabaseDatabaseUrl,
  toSessionDbUrl,
  toTransactionDbUrl,
  webRoot,
} from "./lib/preview-env.mjs";

function isLocalDbUrl(url) {
  try {
    const host = new URL(url.replace(/^postgres:/, "postgresql:")).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

function isRemoteDbUrl(url) {
  return !isLocalDbUrl(url);
}

async function loadEnv() {
  const localEnv = await readEnvFile(".env");
  const uatEnv = await readEnvFile(".env.uat");

  const localDatabaseUrl = localEnv.DATABASE_URL?.trim();
  const uatDatabaseUrl =
    uatEnv.UAT_DATABASE_URL?.trim() || uatEnv.DATABASE_URL?.trim();
  const uatSupabaseUrl =
    uatEnv.UAT_SUPABASE_URL?.trim() || uatEnv.SUPABASE_URL?.trim();

  if (!localDatabaseUrl) {
    throw new Error("DATABASE_URL is required in .env (local Supabase).");
  }
  if (!uatDatabaseUrl) {
    throw new Error(
      "DATABASE_URL or UAT_DATABASE_URL is required in .env.uat (UAT copy source).",
    );
  }
  if (!isLocalDbUrl(localDatabaseUrl)) {
    throw new Error(
      "Refusing to overwrite a non-local DATABASE_URL. Point .env at local Supabase (127.0.0.1:54322).",
    );
  }
  if (!isRemoteDbUrl(uatDatabaseUrl)) {
    throw new Error(
      "UAT database URL in .env.uat must not point at localhost.",
    );
  }

  const repairedLocal = repairSupabaseDatabaseUrl(
    localDatabaseUrl,
    localEnv.SUPABASE_URL,
  );
  const repairedUat = repairSupabaseDatabaseUrl(uatDatabaseUrl, uatSupabaseUrl);

  return {
    localDatabaseUrl: repairedLocal,
    uatDatabaseUrl: repairedUat,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { localDatabaseUrl, uatDatabaseUrl } = await loadEnv();
  const workDir = join(webRoot, ".local-db", "uat-dump");

  console.log("UAT → local database copy");
  console.log(`  Source: UAT (.env.uat)`);
  console.log(
    `  Target: local (.env → ${new URL(localDatabaseUrl.replace(/^postgres:/, "postgresql:")).host})`,
  );

  if (dryRun) {
    console.log("Dry run — no database changes.");
    return;
  }

  await copyDatabaseFromUat({
    uatDbUrl: uatDatabaseUrl,
    destSessionUrl: toSessionDbUrl(localDatabaseUrl),
    destTransactionUrl: toTransactionDbUrl(localDatabaseUrl),
    workDir,
    skipRoles: true,
    localAuthMinimal: true,
  });

  console.log("");
  console.log("✓ Local database now matches UAT.");
  console.log("  Sign in with your UAT email/password (not demo seed users).");
  console.log("  Restart `npm run dev` if it is already running.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
