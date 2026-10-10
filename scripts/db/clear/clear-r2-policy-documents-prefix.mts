#!/usr/bin/env tsx
/**
 * Delete all objects under `policies/` in the target env R2 library bucket.
 *
 *   npm run db:clear:r2:policies:uat -- --dry-run
 *   npm run db:clear:r2:policies:uat -- --confirm
 *   npm run db:clear:r2:policies:prod -- --dry-run
 *   npm run db:clear:r2:policies:prod -- --confirm
 *   npm run db:clear:r2:policies:pr -- --dry-run
 *   npm run db:clear:r2:policies:pr -- --confirm
 *
 * Pair with Postgres + checkpoint reset:
 *   npm run db:clear:legacy:documents:uat -- --confirm
 *   npm run db:clear:legacy:documents:prod -- --confirm
 */
import { resetSharedDbPool } from "../../../app/lib/db/client";
import { listR2ObjectKeys } from "../legacy/lib/legacy-document-r2.mts";
import {
  deletePolicyDocumentsFromR2,
  hasR2Credentials,
  policyDocumentsBucket,
} from "../legacy/lib/legacy-document-upload.mts";
import {
  assertMigrateConfirmed,
  applyPolicyDocumentsBucket,
  loadMigrateTargetEnv,
  logMigrateTarget,
  missingMigrateEnvHelp,
  parseMigrateTargetEnv,
} from "../lib/migrate-target-env.mts";
import { applyEnvFile, readEnvFile } from "../../../deployment/lib/pr-env.mjs";

const PREFIX = "policies/";

function readFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const target = parseMigrateTargetEnv();
  if (!target) {
    throw new Error(missingMigrateEnvHelp());
  }

  const dryRun = readFlag("--dry-run");
  const confirm = readFlag("--confirm");

  applyEnvFile(await readEnvFile(".env"));
  await loadMigrateTargetEnv(target);
  applyPolicyDocumentsBucket(target);
  logMigrateTarget(target, process.env.DATABASE_URL ?? "");
  if (dryRun) console.log("Mode: dry-run (no R2 deletes)");

  assertMigrateConfirmed(target, confirm || dryRun);

  if (!hasR2Credentials()) {
    throw new Error(
      "R2 credentials missing (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT).",
    );
  }

  const bucket = policyDocumentsBucket();
  console.log(`Listing s3://${bucket}/${PREFIX} …`);
  const keys = listR2ObjectKeys(bucket, PREFIX);
  console.log(`Found ${keys.size} object(s) under ${PREFIX}`);

  if (keys.size === 0) {
    await resetSharedDbPool();
    return;
  }

  if (dryRun) {
    console.log(`Would delete ${keys.size} object(s) from ${bucket} only.`);
    await resetSharedDbPool();
    return;
  }

  if (target === "prod") {
    console.warn(
      "⚠️  Production R2 — all policy PDFs under policies/ will be removed.",
    );
  }

  const removed = await deletePolicyDocumentsFromR2([...keys], [bucket]);
  console.log(`Deleted ${removed} object(s) from ${bucket}.`);
  await resetSharedDbPool();
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await resetSharedDbPool().catch(() => {});
    process.exit(1);
  });
