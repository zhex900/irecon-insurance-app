#!/usr/bin/env node
/**
 * Deploy UAT (default) or a per-PR preview environment.
 *
 * PR previews use a single shared Supabase project (.env.pr). Each deploy clears
 * that DB and copies schema + data from UAT (.env.uat), then deploys Workers.
 *
 *   npm run deploy
 *   npm run deploy -- pr-11
 */
import { execFileSync } from "node:child_process";

import {
  copyR2FromUat,
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
import { applyEnvFile, loadPrDeployEnv, readEnvFile } from "./lib/pr-env.mjs";
import {
  configureAuthUrls,
  loadPrSupabase,
  runPreviewMigrations,
  syncPrDatabaseFromUat,
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
  const commit = gitShortHash();
  const appVersion = process.env.VITE_APP_VERSION?.trim() || envName;
  const viteSentryDsn =
    process.env.VITE_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim() || "";
  console.log(
    `→ Building Cloudflare Workers app (version ${appVersion}, commit ${commit})…`,
  );
  await run("npm", ["run", "build"], {
    env: {
      ...process.env,
      VITE_APP_VERSION: appVersion,
      VITE_APP_COMMIT: commit,
      ...(viteSentryDsn ? { VITE_SENTRY_DSN: viteSentryDsn } : {}),
    },
  });
  console.log("✓ Build complete");
  return `${appVersion}-${commit}`;
}

async function deployPreview(envName) {
  await loadPrDeployEnv();

  const names = resourceNames(assertPreviewEnvName(envName));
  const dryRun = hasFlag("--dry-run");
  const skipDb = hasFlag("--skip-db");
  const skipR2 = hasFlag("--skip-r2");
  const skipBuild = hasFlag("--skip-build");
  const skipMigrate = hasFlag("--skip-migrate");
  const secretOnly = hasFlag("--secret-only");

  console.log(`Preview environment: ${names.label}`);
  console.log(`  App URL ${names.appUrl} (from --env, not .env.pr)`);
  console.log(`  PDF     ${names.pdfWorker}`);
  console.log(`  Excel   ${names.excelWorker}`);
  console.log(`  R2      ${names.avatarsBucket}, ${names.libraryBucket}`);
  console.log(`  Database shared PR Supabase (.env.pr) ← copy from UAT`);

  if (dryRun) {
    console.log("Dry run — no resources created.");
    return;
  }

  const state = await loadState(names.label);

  const supabase = skipDb
    ? await loadPrSupabase({ names })
    : await (async () => {
        const config = await syncPrDatabaseFromUat({ names });
        if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
          await configureAuthUrls({
            projectRef: config.projectRef,
            appUrl: names.appUrl,
          });
        } else {
          console.warn(
            "Warning: SUPABASE_ACCESS_TOKEN not set — skipping PR Auth URL configuration.",
          );
        }
        return config;
      })();

  if (!skipMigrate) {
    await runPreviewMigrations(supabase.sessionUrl);
  } else {
    console.log("→ Skipping database migrations (--skip-migrate)");
  }

  if (skipR2) {
    console.log(
      "→ Skipping R2 object copy (--skip-r2); ensuring buckets exist",
    );
    await ensureR2Buckets(names);
  } else {
    await copyR2FromUat(names);
  }

  const hyperdriveId = await ensureHyperdrive({
    names,
    connectionString: supabase.sessionUrl,
    existingId: state?.hyperdriveId,
    forceUpdate: !skipDb,
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
if (!envName || envName === "uat") {
  applyEnvFile(await readEnvFile(".env.uat"));
  await import("./deploy-uat.mjs");
} else {
  deployPreview(envName).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
