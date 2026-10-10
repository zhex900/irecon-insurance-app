#!/usr/bin/env tsx
/**
 * Link legacy policy_document rows to objects already in R2 (no local PDFs).
 *
 *   npm run db:repair:legacy-documents-from-r2 -- --env=uat --dry-run
 *   npm run db:repair:legacy-documents-from-r2 -- --env=uat --confirm
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { resetSharedDbPool } from "../../../app/lib/db/client";
import {
  assertMigrateConfirmed,
  applyPolicyDocumentsBucket,
  loadMigrateTargetEnv,
  logMigrateTarget,
  missingMigrateEnvHelp,
  parseMigrateTargetEnv,
  readOption,
} from "../lib/migrate-target-env.mts";
import { upsertLegacyPolicyDocumentInPostgres } from "../legacy/lib/legacy-document-postgres.mts";
import {
  buildLegacyPolicyDocumentEntryFromRow,
  planLegacyPolicyDocuments,
} from "../legacy/lib/legacy-document-plan.mts";
import {
  filterPolicyDocumentsForTarget,
  loadTargetPolicyUuidSet,
} from "../legacy/lib/legacy-document-target.mts";
import { hasR2Credentials } from "../legacy/lib/legacy-document-upload.mts";
import type { LegacyDomainPayload } from "../legacy/lib/legacy-payload.ts";
import { resolvePolicyDocumentRoots } from "../legacy/lib/legacy-document-path.mts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_JSON = join(repoRoot, "_archive/data/legacy-export.json");

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
  const exportPath = readOption("--file") ?? DEFAULT_JSON;

  if (!existsSync(exportPath)) {
    throw new Error(`Export file not found: ${exportPath}`);
  }

  const databaseUrl = await loadMigrateTargetEnv(target);
  applyPolicyDocumentsBucket(target);
  logMigrateTarget(target, databaseUrl);
  if (dryRun) console.log("Mode: dry-run (no Postgres writes)");

  if (!hasR2Credentials()) {
    throw new Error(
      "R2 credentials missing in .env (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT).",
    );
  }

  assertMigrateConfirmed(target, confirm || dryRun);

  const payload = JSON.parse(
    readFileSync(exportPath, "utf8"),
  ) as LegacyDomainPayload;

  const targetPolicyUuids = await loadTargetPolicyUuidSet();
  const { documents: scoped, skipped } = filterPolicyDocumentsForTarget(
    payload.policyDocuments,
    targetPolicyUuids,
  );

  if (skipped > 0) {
    console.log(
      `Scoped to ${scoped.length} document row(s) (${skipped} skipped — policy not on target)`,
    );
  }

  const bucket = process.env.R2_POLICY_DOCUMENTS_BUCKET?.trim();
  if (!bucket) {
    throw new Error("R2_POLICY_DOCUMENTS_BUCKET is not set.");
  }

  const roots = resolvePolicyDocumentRoots(undefined);
  const plan = await planLegacyPolicyDocuments({
    documents: scoped,
    roots,
    bucket,
    skipR2: false,
  });

  const exportDocById = new Map(
    scoped.map((doc) => [doc.policyDocumentId, doc]),
  );

  let linked = 0;
  let skippedNoPolicy = 0;
  let notInR2 = 0;

  for (const row of plan.rows) {
    if (row.status !== "already_in_r2") {
      notInR2 += 1;
      continue;
    }

    const exportDoc = exportDocById.get(row.policyDocumentId);
    if (!exportDoc) continue;

    const entry = buildLegacyPolicyDocumentEntryFromRow(
      exportDoc,
      "repair:legacy-r2",
    );
    if (dryRun) {
      linked += 1;
      continue;
    }

    const ok = await upsertLegacyPolicyDocumentInPostgres(entry);
    if (ok) linked += 1;
    else skippedNoPolicy += 1;
  }

  console.log(
    dryRun
      ? `Would link ${linked} document(s) from R2 to Postgres`
      : `Linked ${linked} document(s) from R2 to Postgres`,
  );
  console.log(`  not in R2 (no object to link): ${notInR2}`);
  if (!dryRun && skippedNoPolicy > 0) {
    console.log(`  skipped (policy not found on target): ${skippedNoPolicy}`);
  }

  await resetSharedDbPool();
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await resetSharedDbPool().catch(() => {});
    process.exit(1);
  });
