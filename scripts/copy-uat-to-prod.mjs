#!/usr/bin/env node
/**
 * Replace production Supabase Postgres with a full copy of UAT.
 *
 *   npm run db:copy:prod -- --confirm
 *   npm run db:copy:prod -- --dry-run
 *
 * Reads UAT from `.env.uat` and production from `.env.production`.
 * DESTRUCTIVE — drops production public schema and truncates auth/storage.
 */
import { join } from "node:path";

import {
  assertProductionDatabaseUrl,
  assertSafeUatCopy,
  extractSupabaseProjectRef,
} from "./lib/production-env.mjs";
import { readEnvFile } from "./lib/pr-env.mjs";
import {
  repairSupabaseDatabaseUrl,
  toSessionDbUrl,
  toTransactionDbUrl,
  webRoot,
} from "./lib/preview-env.mjs";
import { copyDatabaseFromUat } from "./lib/uat-data-copy.mjs";

function isLocalDbUrl(url) {
  try {
    const host = new URL(url.replace(/^postgres:/, "postgresql:")).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

async function loadEnv() {
  const uatEnv = await readEnvFile(".env.uat");
  const prodEnv = await readEnvFile(".env.production");

  const uatDatabaseUrl =
    uatEnv.UAT_DATABASE_URL?.trim() || uatEnv.DATABASE_URL?.trim();
  const uatSupabaseUrl =
    uatEnv.UAT_SUPABASE_URL?.trim() || uatEnv.SUPABASE_URL?.trim();
  const prodDatabaseUrl = prodEnv.DATABASE_URL?.trim();
  const prodSupabaseUrl = prodEnv.SUPABASE_URL?.trim();

  if (!uatDatabaseUrl) {
    throw new Error(
      "DATABASE_URL or UAT_DATABASE_URL is required in .env.uat (UAT copy source).",
    );
  }
  if (!prodDatabaseUrl) {
    throw new Error("DATABASE_URL is required in .env.production.");
  }
  if (isLocalDbUrl(uatDatabaseUrl)) {
    throw new Error("UAT database URL in .env.uat must not point at localhost.");
  }
  if (isLocalDbUrl(prodDatabaseUrl)) {
    throw new Error(
      "Production DATABASE_URL must not point at localhost. Use .env.production.",
    );
  }

  assertProductionDatabaseUrl(prodDatabaseUrl);

  const repairedUat = repairSupabaseDatabaseUrl(uatDatabaseUrl, uatSupabaseUrl);
  const repairedProd = repairSupabaseDatabaseUrl(
    prodDatabaseUrl,
    prodSupabaseUrl,
  );

  assertSafeUatCopy({
    uatDbUrl: repairedUat,
    prodDbUrl: repairedProd,
    uatSupabaseRef:
      extractSupabaseProjectRef(uatSupabaseUrl) ||
      extractSupabaseProjectRef(repairedUat),
    prodSupabaseRef:
      extractSupabaseProjectRef(prodSupabaseUrl) ||
      extractSupabaseProjectRef(repairedProd),
  });

  return {
    uatDatabaseUrl: repairedUat,
    prodDatabaseUrl: repairedProd,
    prodSupabaseUrl,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirmed = process.argv.includes("--confirm");
  const { uatDatabaseUrl, prodDatabaseUrl, prodSupabaseUrl } = await loadEnv();
  const workDir = join(webRoot, ".production-env", "uat-dump");

  const prodHost = new URL(
    prodDatabaseUrl.replace(/^postgres:/, "postgresql:"),
  ).host;

  console.log("UAT → production database copy");
  console.log("  Source: UAT (.env.uat)");
  console.log(`  Target: production (.env.production → ${prodHost})`);
  if (prodSupabaseUrl) {
    console.log(`  Supabase: ${prodSupabaseUrl}`);
  }

  if (dryRun) {
    console.log("Dry run — no database changes.");
    return;
  }

  if (!confirmed) {
    throw new Error(
      "Refusing to overwrite production without --confirm.\n" +
        "  npm run db:copy:prod -- --confirm",
    );
  }

  console.log("");
  console.warn(
    "⚠️  This will WIPE the production database and replace it with UAT data.",
  );

  await copyDatabaseFromUat({
    uatDbUrl: uatDatabaseUrl,
    destSessionUrl: toSessionDbUrl(prodDatabaseUrl),
    destTransactionUrl: toTransactionDbUrl(prodDatabaseUrl),
    workDir,
    skipRoles: true,
  });

  console.log("");
  console.log("✓ Production database now matches UAT.");
  console.log(
    "  Run `npm run deploy:prod -- --skip-migrate` if Workers are already deployed.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
