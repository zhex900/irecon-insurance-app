#!/usr/bin/env node
/**
 * Tear down a per-PR preview environment (Workers only for pr-*).
 * Shared PR Hyperdrive, R2 buckets, and Supabase (.env.pr) are left intact.
 *
 *   npm run destroy -- pr-11
 */
import {
  deleteHyperdrive,
  deletePreviewWorkers,
  emptyAndDeleteR2Buckets,
  findHyperdriveId,
} from "./lib/preview-cloudflare.mjs";
import {
  assertPreviewEnvName,
  hasFlag,
  isPrPreviewSlug,
  parseEnvName,
  removeStateDir,
  resourceNames,
} from "./lib/preview-env.mjs";
import { loadPrDeployEnv } from "./lib/pr-env.mjs";

async function destroyPreview(envName) {
  await loadPrDeployEnv();

  const names = resourceNames(assertPreviewEnvName(envName));
  const dryRun = hasFlag("--dry-run");

  console.log(`Destroy preview environment: ${names.label}`);
  console.log(
    `  Workers  ${names.appWorker}, ${names.pdfWorker}, ${names.excelWorker}`,
  );
  console.log(`  R2       ${names.avatarsBucket}, ${names.libraryBucket}`);
  console.log(`  App URL  ${names.appUrl}`);
  if (isPrPreviewSlug(names.slug)) {
    console.log("  R2 cleanup skipped (shared PR buckets)");
    console.log("  Hyperdrive cleanup skipped (shared insurance-app-pr)");
  }
  console.log("  Database shared PR Supabase (.env.pr) — left intact");

  if (dryRun) {
    console.log("Dry run — no resources deleted.");
    return;
  }

  await deletePreviewWorkers(names);
  if (!isPrPreviewSlug(names.slug)) {
    await emptyAndDeleteR2Buckets(names);
    const hyperdriveId = await findHyperdriveId(names.hyperdriveName);
    await deleteHyperdrive(hyperdriveId);
  }

  await removeStateDir(names.label);
  console.log(`✓ Destroyed ${names.label}`);
}

const envName = parseEnvName();
if (!envName) {
  console.error("Missing env name. Example: npm run destroy -- pr-11");
  process.exit(1);
}

destroyPreview(envName).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
