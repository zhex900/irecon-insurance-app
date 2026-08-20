#!/usr/bin/env tsx
/**
 * Remove migrated legacy policy documents from Postgres, R2, and the sync checkpoint.
 *
 *   npm run db:clear:legacy:documents:local
 *   npm run db:clear:legacy:documents:uat -- --dry-run
 *   npm run db:clear:legacy:documents:prod -- --confirm
 */
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { resetSharedDbPool } from "../../../app/lib/db/client";
import { clearLegacyDocuments } from "../legacy/lib/clear-legacy-documents.mts";
import { maskDatabaseUrl } from "../lib/clear-domain-data.mts";
import { loadLegacyEnvFile } from "../legacy/lib/legacy-mssql.mts";
import {
  assertMigrateConfirmed,
  applyPolicyDocumentsBucket,
  loadMigrateTargetEnv,
  logMigrateTarget,
  missingMigrateEnvHelp,
  parseMigrateTargetEnv,
  readOption,
} from "../lib/migrate-target-env.mts";
import { documentSyncStatePathForEnv } from "../legacy/lib/legacy-document-sync-state.mts";
import { applyEnvFile, readEnvFile } from "../../../deployment/lib/pr-env.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_EXPORT = join(repoRoot, "_archive/data/legacy-export.json");

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseExportPath(): string {
  const file = readOption("--file");
  if (!file) return DEFAULT_EXPORT;
  return isAbsolute(file) ? file : resolve(process.cwd(), file);
}

async function askConfirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(prompt);
    return answer.trim().toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}

async function main() {
  const targetEnv = parseMigrateTargetEnv();
  if (!targetEnv) {
    console.error(missingMigrateEnvHelp());
    process.exit(1);
  }

  const dryRun = readFlag("--dry-run");
  const confirm = readFlag("--confirm");
  const skipR2 = readFlag("--skip-r2");
  const exportPath = parseExportPath();

  assertMigrateConfirmed(targetEnv, confirm || dryRun);

  const localEnv = await readEnvFile(".env");
  applyEnvFile(localEnv);
  loadLegacyEnvFile();

  const databaseUrl = await loadMigrateTargetEnv(targetEnv);
  applyPolicyDocumentsBucket(targetEnv);
  logMigrateTarget(targetEnv, databaseUrl);
  console.log(`Database: ${maskDatabaseUrl(databaseUrl)}`);
  await resetSharedDbPool();

  const preview = await clearLegacyDocuments({
    exportPath,
    dryRun: true,
    skipR2,
    syncStatePath: documentSyncStatePathForEnv(targetEnv),
  });

  console.log(`Export snapshot: ${exportPath}`);
  console.log(
    `Would remove ${preview.legacyDocumentsRemoved} legacy document(s) from ${preview.policiesCleared} polic(y/ies)` +
      (skipR2 ? "" : ` and ${preview.r2KeysRemoved} R2 object(s)`) +
      (preview.syncStateCleared ? ", plus reset checkpoint" : ""),
  );

  if (dryRun) {
    await resetSharedDbPool();
    return;
  }

  if (targetEnv === "prod") {
    console.warn(
      "⚠️  Production — migrated PDFs and metadata will be removed.",
    );
  }

  if (!confirm) {
    const confirmed = await askConfirm('Type "yes" to continue: ');
    if (!confirmed) {
      console.log("Aborted.");
      process.exit(1);
    }
  }

  const summary = await clearLegacyDocuments({
    exportPath,
    skipR2,
    syncStatePath: documentSyncStatePathForEnv(targetEnv),
  });

  console.log(
    `Removed ${summary.legacyDocumentsRemoved} legacy document(s) from ${summary.policiesCleared} polic(y/ies)` +
      (skipR2 ? "" : `, deleted ${summary.r2KeysRemoved} R2 object(s)`) +
      (summary.syncStateCleared ? ", checkpoint reset" : "") +
      ".",
  );
  await resetSharedDbPool();
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await resetSharedDbPool().catch(() => {});
    process.exit(1);
  });
