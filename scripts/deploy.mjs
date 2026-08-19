#!/usr/bin/env node
/**
 * Deploy UAT (default) or a per-PR preview environment.
 *
 * UAT uses `.env.uat` — same Cloudflare flow as PR (Hyperdrive, secrets, Workers).
 *
 * PR previews use a single shared Supabase project (.env.pr). Each deploy clears
 * that DB and copies schema + data from UAT (.env.uat), then deploys Workers.
 *
 *   npm run deploy:uat
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
  writeUatWranglerConfigs,
} from "./lib/preview-cloudflare.mjs";
import {
  assertPreviewEnvName,
  hasFlag,
  loadState,
  loadUatState,
  parseEnvName,
  resourceNames,
  run,
  saveState,
  saveUatState,
  webRoot,
} from "./lib/preview-env.mjs";
import { loadPrDeployEnv } from "./lib/pr-env.mjs";
import { uploadSentrySourceMaps } from "./lib/sentry-deploy.mjs";
import {
  UAT_HYPERDRIVE_ID,
  loadUatDeployEnv,
  uatNames,
  uatSupabaseFromEnv,
} from "./lib/uat-env.mjs";
import {
  configureAuthUrls,
  loadPrSupabase,
  runPreviewMigrations,
  runUatMigrations,
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

async function deployUat() {
  await loadUatDeployEnv();

  const names = uatNames();
  const supabase = uatSupabaseFromEnv();
  const dryRun = hasFlag("--dry-run");
  const skipBuild = hasFlag("--skip-build");
  const skipMigrate = hasFlag("--skip-migrate");
  const skipHyperdrive = hasFlag("--skip-hyperdrive");
  const secretOnly = hasFlag("--secret-only");

  console.log("UAT environment");
  console.log(`  App URL ${names.appUrl}`);
  console.log(`  App     ${names.appWorker}`);
  console.log(`  PDF     ${names.pdfWorker}`);
  console.log(`  Excel   ${names.excelWorker}`);
  console.log(`  R2      ${names.avatarsBucket}, ${names.libraryBucket}`);
  console.log(`  Supabase ${supabase.supabaseUrl}`);

  if (dryRun) {
    console.log("Dry run — no resources changed.");
    return;
  }

  const state = await loadUatState();

  if (secretOnly) {
    const hyperdriveId = await ensureHyperdrive({
      names,
      connectionString: supabase.sessionUrl,
      existingId: state?.hyperdriveId || UAT_HYPERDRIVE_ID,
      forceUpdate: !skipHyperdrive,
    });
    await syncPreviewSecrets({
      names,
      supabase,
      appUrl: names.appUrl,
    });
    await saveUatState({
      ...(state ?? {}),
      env: "uat",
      appUrl: names.appUrl,
      supabaseProjectRef: supabase.projectRef,
      supabaseUrl: supabase.supabaseUrl,
      hyperdriveId,
      updatedAt: new Date().toISOString(),
    });
    console.log("Done (--secret-only).");
    return;
  }

  await ensureR2Buckets(names);

  if (!skipMigrate) {
    await runUatMigrations(supabase.sessionUrl);
  } else {
    console.log("→ Skipping database migrations (--skip-migrate)");
  }

  const hyperdriveId = await ensureHyperdrive({
    names,
    connectionString: supabase.sessionUrl,
    existingId: state?.hyperdriveId || UAT_HYPERDRIVE_ID,
    forceUpdate: !skipHyperdrive,
  });

  const configs = await writeUatWranglerConfigs({
    names,
    supabaseUrl: supabase.supabaseUrl,
    hyperdriveId,
  });

  let release;
  if (!skipBuild) {
    release = await buildApp("uat");
    try {
      await uploadSentrySourceMaps(release);
    } catch (error) {
      console.warn(
        "Warning: Sentry source map upload failed.",
        error instanceof Error ? error.message : error,
      );
    }
  }

  await deployPreviewWorkers({ names, configs });
  await syncPreviewSecrets({ names, supabase, appUrl: names.appUrl });

  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    try {
      await configureAuthUrls({
        projectRef: supabase.projectRef,
        appUrl: names.appUrl,
      });
    } catch (error) {
      console.warn(
        "Warning: could not update Supabase Auth URLs.",
        error instanceof Error ? error.message : error,
      );
    }
  } else {
    console.warn(
      "Warning: SUPABASE_ACCESS_TOKEN unset — skipping Auth Site URL update.",
    );
  }

  await saveUatState({
    env: "uat",
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
    updatedAt: new Date().toISOString(),
    ...(release ? { release } : {}),
  });

  console.log("");
  console.log(`UAT deployed: ${names.appUrl}`);
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
      turnstile: false,
    });
    console.log("Done (--secret-only).");
    return;
  }

  if (!skipBuild) {
    await buildApp(names.label);
  }

  await deployPreviewWorkers({ names, configs });
  await syncPreviewSecrets({
    names,
    supabase,
    appUrl: names.appUrl,
    turnstile: false,
  });

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
  deployUat().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
} else {
  deployPreview(envName).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
