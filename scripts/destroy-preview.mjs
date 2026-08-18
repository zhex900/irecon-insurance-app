#!/usr/bin/env node
/**
 * Tear down a per-PR preview environment.
 *
 *   npm run destroy --env pr-11
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
  loadState,
  parseEnvName,
  removeStateDir,
  resourceNames,
} from "./lib/preview-env.mjs";
import { destroySupabase, findBranchByName } from "./lib/preview-supabase.mjs";

async function destroyPreview(envName) {
  const names = resourceNames(assertPreviewEnvName(envName));
  const dryRun = hasFlag("--dry-run");
  const state = await loadState(names.label);

  console.log(`Destroy preview environment: ${names.label}`);
  console.log(
    `  Workers  ${names.appWorker}, ${names.pdfWorker}, ${names.excelWorker}`,
  );
  console.log(`  R2       ${names.avatarsBucket}, ${names.libraryBucket}`);
  console.log(`  App URL  ${names.appUrl}`);
  if (state?.supabaseBranchId || state?.supabaseProjectRef) {
    console.log(
      `  Supabase branch ${state.supabaseBranchId ?? state.supabaseProjectRef}`,
    );
  }

  if (dryRun) {
    console.log("Dry run — no resources deleted.");
    return;
  }

  await deletePreviewWorkers(names);
  await emptyAndDeleteR2Buckets(names);

  const hyperdriveId =
    state?.hyperdriveId || (await findHyperdriveId(names.hyperdriveName));
  await deleteHyperdrive(hyperdriveId);

  const branchId = state?.supabaseBranchId;
  const projectRef = state?.supabaseProjectRef;
  if (branchId || projectRef) {
    await destroySupabase({ branchId, projectRef });
  } else {
    const branch = await findBranchByName(names.supabaseBranchName);
    if (branch) {
      await destroySupabase({
        branchId: branch.id,
        projectRef: branch.project_ref,
      });
    } else {
      console.log("→ No Supabase branch found to delete");
    }
  }

  await removeStateDir(names.label);
  console.log(`✓ Destroyed ${names.label}`);
}

const envName = parseEnvName();
if (!envName) {
  console.error("Missing --env. Example: npm run destroy --env pr-11");
  process.exit(1);
}

destroyPreview(envName).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
