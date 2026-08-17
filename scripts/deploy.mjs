#!/usr/bin/env node
/**
 * Deploy staging (default) or a per-PR preview environment.
 *
 *   npm run deploy
 *   npm run deploy --env pr-11
 */
import { execFileSync } from "node:child_process";

import {
  copyR2FromStaging,
  deployPreviewWorkers,
  ensureHyperdrive,
  ensureR2Buckets,
  syncPreviewSecrets,
  writePreviewWranglerConfigs,
} from "./lib/preview-cloudflare.mjs";
import {
  assertPreviewEnvName,
  hasFlag,
  loadState,
  parseEnvName,
  resourceNames,
  run,
  saveState,
  webRoot,
} from "./lib/preview-env.mjs";
import {
  loadExistingSupabase,
  provisionSupabase,
} from "./lib/preview-supabase.mjs";

function gitShortHash() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: webRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

async function buildApp(envName) {
  const appVersion =
    process.env.VITE_APP_VERSION?.trim() || `${envName}-${gitShortHash()}`;
  const viteSentryDsn =
    process.env.VITE_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim() || "";
  console.log(`→ Building Cloudflare Workers app (version ${appVersion})…`);
  await run("npm", ["run", "build"], {
    env: {
      ...process.env,
      VITE_APP_VERSION: appVersion,
      ...(viteSentryDsn ? { VITE_SENTRY_DSN: viteSentryDsn } : {}),
    },
  });
  console.log("✓ Build complete");
  return appVersion;
}

async function deployPreview(envName) {
  const names = resourceNames(assertPreviewEnvName(envName));
  const dryRun = hasFlag("--dry-run");
  const skipDb = hasFlag("--skip-db");
  const skipR2 = hasFlag("--skip-r2");
  const skipBuild = hasFlag("--skip-build");
  const secretOnly = hasFlag("--secret-only");

  console.log(`Preview environment: ${names.label}`);
  console.log(`  App     ${names.appUrl}`);
  console.log(`  PDF     ${names.pdfWorker}`);
  console.log(`  Excel   ${names.excelWorker}`);
  console.log(`  R2      ${names.avatarsBucket}, ${names.libraryBucket}`);
  console.log(`  Supabase ${names.supabaseName}`);

  if (dryRun) {
    console.log("Dry run — no resources created.");
    return;
  }

  if (!process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is required for preview deploys (https://supabase.com/dashboard/account/tokens).",
    );
  }

  const supabase = skipDb
    ? await loadExistingSupabase(names)
    : await provisionSupabase({ names });

  if (skipR2) {
    console.log(
      "→ Skipping R2 object copy (--skip-r2); ensuring buckets exist",
    );
    await ensureR2Buckets(names);
  } else {
    await copyR2FromStaging(names);
  }

  const state = await loadState(names.label);
  const hyperdriveId = await ensureHyperdrive({
    names,
    connectionString: supabase.sessionUrl,
    existingId: state?.hyperdriveId,
  });

  const configs = await writePreviewWranglerConfigs({
    names,
    supabaseUrl: supabase.supabaseUrl,
    hyperdriveId,
  });

  if (secretOnly) {
    await syncPreviewSecrets({
      names,
      supabase,
      appUrl: names.appUrl,
    });
    console.log("Done (--secret-only).");
    return;
  }

  if (!skipBuild) {
    await buildApp(names.label);
  }

  await deployPreviewWorkers({ names, configs });
  await syncPreviewSecrets({ names, supabase, appUrl: names.appUrl });

  await saveState(names.label, {
    env: names.label,
    appUrl: names.appUrl,
    supabaseProjectRef: supabase.projectRef,
    supabaseUrl: supabase.supabaseUrl,
    hyperdriveId,
    workers: {
      app: names.appWorker,
      pdf: names.pdfWorker,
      excel: names.excelWorker,
    },
    r2: {
      avatars: names.avatarsBucket,
      library: names.libraryBucket,
    },
    createdAt: new Date().toISOString(),
  });

  console.log("");
  console.log(`Preview ready: ${names.appUrl}`);
  console.log(`Supabase:      ${supabase.supabaseUrl}`);
}

const envName = parseEnvName();
if (!envName || envName === "staging") {
  await import("./deploy-staging.mjs");
} else {
  deployPreview(envName).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
