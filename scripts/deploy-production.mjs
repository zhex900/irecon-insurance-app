#!/usr/bin/env node
/**
 * Build + deploy insurance-app-production to Cloudflare Workers.
 *
 * By default this deploys code + secrets only (no data changes).
 * Pass --copy-from-staging to replace production Postgres + R2 with staging.
 *
 * Usage:
 *   npm run deploy:prod
 *   npm run deploy:prod -- --copy-from-staging
 *   npm run deploy:prod -- --copy-from-staging --skip-db
 *   npm run deploy:prod -- --copy-from-staging --skip-r2
 *   node --env-file=.env.production scripts/deploy-production.mjs --secret-only
 */
import { spawn, execFileSync } from "node:child_process";
import { readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  copyR2FromStaging,
  deployPreviewWorkers,
  ensureHyperdrive,
  ensureR2Buckets,
  putWorkerSecret,
} from "./lib/preview-cloudflare.mjs";
import { configureAuthUrls, copyPgsodiumKey } from "./lib/preview-supabase.mjs";
import {
  assertProductionDatabaseUrl,
  assertSafeStagingCopy,
  extractSupabaseProjectRef,
  hasFlag,
  loadStagingEnv,
  loadState,
  productionNames,
  productionAuthExtraOrigins,
  productionAuthDomains,
  productionWranglerCustomDomains,
  productionR2HelperWrangler,
  productionRoot,
  saveState,
  writeProductionWranglerConfigs,
} from "./lib/production-env.mjs";
import { copyDatabaseFromStaging } from "./lib/staging-data-copy.mjs";
import {
  toSessionDbUrl,
  toTransactionDbUrl,
  webRoot,
} from "./lib/preview-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const copyFromStaging = hasFlag("--copy-from-staging");
const skipDb = hasFlag("--skip-db");
const skipR2 = hasFlag("--skip-r2");
const skipBuild = hasFlag("--skip-build");
const secretOnly = hasFlag("--secret-only");
const dryRun = hasFlag("--dry-run");

function run(command, args, { input, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: cwd ?? webRoot,
      stdio: input != null ? ["pipe", "inherit", "inherit"] : "inherit",
      env: env ?? process.env,
    });
    if (input != null) {
      child.stdin.write(input);
      child.stdin.end();
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

function resolveProductionAppVersion() {
  const explicit = process.env.VITE_APP_VERSION?.trim();
  if (explicit) return explicit;
  try {
    const hash = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: webRoot,
      encoding: "utf8",
    }).trim();
    return `production-${hash}`;
  } catch {
    return "production-unknown";
  }
}

function productionDbUrls(databaseUrl) {
  return {
    sessionUrl: toSessionDbUrl(databaseUrl),
    transactionUrl: toTransactionDbUrl(databaseUrl),
  };
}

async function syncProductionSecrets(names) {
  const databaseUrl = process.env.DATABASE_URL;
  assertProductionDatabaseUrl(databaseUrl);

  const secrets = {
    DATABASE_URL: databaseUrl,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    APP_URL: names.appUrl,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    SENTRY_DSN: process.env.SENTRY_DSN,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  };

  for (const [name, value] of Object.entries(secrets)) {
    await putWorkerSecret(names.appWorker, name, value ?? "");
  }

  if (!process.env.SUPABASE_PUBLISHABLE_KEY?.trim()) {
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEY is required for production login. Add it to .env.production.",
    );
  }
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.EMAIL_FROM?.trim()) {
    console.warn(
      "Warning: RESEND_API_KEY / EMAIL_FROM empty — policy document and password reset email will fail until set.",
    );
  }
  if (!process.env.SENTRY_DSN?.trim()) {
    console.warn(
      "Warning: SENTRY_DSN empty — Worker error reporting disabled until set.",
    );
  }
  if (!process.env.TURNSTILE_SECRET_KEY?.trim()) {
    console.warn(
      "Warning: TURNSTILE_SECRET_KEY empty — login Turnstile verification disabled until set.",
    );
  }
}

async function deleteSourceMaps(rootDir) {
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    let removed = 0;
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        removed += await walk(path);
      } else if (entry.name.endsWith(".map")) {
        await unlink(path);
        removed += 1;
      }
    }
    return removed;
  }
  return walk(rootDir);
}

async function writeSentrySourcemapIgnoreFile(clientDir) {
  const assetsDir = join(clientDir, "assets");
  let entries = [];
  try {
    entries = await readdir(assetsDir);
  } catch {
    return null;
  }
  const maps = new Set(entries.filter((name) => name.endsWith(".map")));
  const withoutMap = entries.filter(
    (name) => name.endsWith(".js") && !maps.has(`${name}.map`),
  );
  if (withoutMap.length === 0) return null;
  const ignorePath = join(clientDir, ".sentry-sourcemaps-ignore");
  await writeFile(
    ignorePath,
    `${withoutMap.map((name) => `**/${name}`).join("\n")}\n`,
  );
  return ignorePath;
}

async function uploadSentrySourceMaps(appVersion) {
  const authToken = process.env.SENTRY_AUTH_TOKEN?.trim();
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();
  const clientDir = join(webRoot, "build/client");

  try {
    if (!authToken || !org || !project) {
      console.warn(
        "Warning: SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT missing — skipping source map upload.",
      );
      return;
    }

    const ignoreFile = await writeSentrySourcemapIgnoreFile(clientDir);
    const ignoreArgs = ignoreFile ? ["--ignore-file", ignoreFile] : [];

    console.log(`→ Uploading Sentry source maps for release ${appVersion}…`);
    await run(
      "npx",
      ["sentry-cli", "sourcemaps", "inject", ...ignoreArgs, clientDir],
      {
        env: {
          ...process.env,
          SENTRY_AUTH_TOKEN: authToken,
          SENTRY_ORG: org,
          SENTRY_PROJECT: project,
        },
      },
    );
    await run(
      "npx",
      [
        "sentry-cli",
        "sourcemaps",
        "upload",
        "--release",
        appVersion,
        ...ignoreArgs,
        clientDir,
      ],
      {
        env: {
          ...process.env,
          SENTRY_AUTH_TOKEN: authToken,
          SENTRY_ORG: org,
          SENTRY_PROJECT: project,
        },
      },
    );
    console.log("✓ Sentry source maps uploaded");
  } finally {
    const removed = await deleteSourceMaps(join(webRoot, "build"));
    if (removed > 0) {
      console.log(`✓ Removed ${removed} source map(s) before deploy`);
    }
  }
}

async function copyStagingData(names) {
  const prodDbUrl = process.env.DATABASE_URL?.trim();
  assertProductionDatabaseUrl(prodDbUrl);
  const staging = await loadStagingEnv();
  const prodSupabaseUrl = process.env.SUPABASE_URL?.trim();
  assertSafeStagingCopy({
    stagingDbUrl: staging.databaseUrl,
    prodDbUrl,
    stagingSupabaseRef: staging.projectRef,
    prodSupabaseRef: extractSupabaseProjectRef(prodSupabaseUrl),
  });

  console.log("");
  console.log("⚠  --copy-from-staging will REPLACE production database and R2.");
  console.log(`   Staging DB ref: ${staging.projectRef}`);
  console.log(
    `   Production DB:  ${extractSupabaseProjectRef(prodSupabaseUrl) ?? "(from SUPABASE_URL)"}`,
  );
  console.log("");

  if (!skipDb) {
    const { sessionUrl, transactionUrl } = productionDbUrls(prodDbUrl);
    await copyDatabaseFromStaging({
      stagingDbUrl: staging.databaseUrl,
      destSessionUrl: sessionUrl,
      destTransactionUrl: transactionUrl,
      workDir: join(productionRoot, "dump"),
      skipRoles: true,
    });
    const prodRef = extractSupabaseProjectRef(prodSupabaseUrl);
    if (prodRef && process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
      try {
        await copyPgsodiumKey(staging.projectRef, prodRef);
      } catch (error) {
        console.warn(
          "Warning: could not copy pgsodium key (ok if Vault is unused).",
          error instanceof Error ? error.message : error,
        );
      }
    }
  } else {
    console.log("→ Skipping database copy (--skip-db)");
  }

  if (!skipR2) {
    const r2WranglerPath = join(productionRoot, "wrangler.r2.jsonc");
    await copyR2FromStaging(names, {
      wranglerPath: r2WranglerPath,
      buildWrangler: (params) => productionR2HelperWrangler(names, params),
    });
  } else {
    console.log("→ Skipping R2 copy (--skip-r2); ensuring buckets exist");
    await ensureR2Buckets(names);
  }
}

async function main() {
  const names = productionNames();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is required in .env.production.");
  }

  assertProductionDatabaseUrl(process.env.DATABASE_URL);

  console.log("Production environment");
  console.log(`  App     ${names.appUrl}`);
  console.log(`  Worker  ${names.appWorker}`);
  console.log(`  PDF     ${names.pdfWorker}`);
  console.log(`  Excel   ${names.excelWorker}`);
  console.log(`  R2      ${names.avatarsBucket}, ${names.libraryBucket}`);
  console.log(`  Supabase ${supabaseUrl}`);
  console.log(`  Domains ${productionWranglerCustomDomains().join(", ")} (Worker)`);
  console.log(`  Auth hosts ${productionAuthDomains().join(", ")}`);

  if (dryRun) {
    console.log("Dry run — no resources changed.");
    return;
  }

  if (secretOnly) {
    await syncProductionSecrets(names);
    console.log("Done (--secret-only).");
    return;
  }

  if (copyFromStaging) {
    await copyStagingData(names);
  } else {
    await ensureR2Buckets(names);
  }

  const state = await loadState();
  const hyperdriveId = await ensureHyperdrive({
    names,
    connectionString: toSessionDbUrl(process.env.DATABASE_URL),
    existingId: state?.hyperdriveId,
  });

  const configs = await writeProductionWranglerConfigs({
    names,
    supabaseUrl,
    hyperdriveId,
  });

  const appVersion = resolveProductionAppVersion();

  if (!skipBuild) {
    const viteSentryDsn =
      process.env.VITE_SENTRY_DSN?.trim() ||
      process.env.SENTRY_DSN?.trim() ||
      "";
    console.log(`→ Building Cloudflare Workers app (version ${appVersion})…`);
    await run("npm", ["run", "build"], {
      env: {
        ...process.env,
        VITE_APP_VERSION: appVersion,
        ...(viteSentryDsn ? { VITE_SENTRY_DSN: viteSentryDsn } : {}),
      },
    });
    console.log("✓ Build complete");

    try {
      await uploadSentrySourceMaps(appVersion);
    } catch (error) {
      console.warn(
        "Warning: Sentry source map upload failed.",
        error instanceof Error ? error.message : error,
      );
    }
  }

  await deployPreviewWorkers({ names, configs });

  try {
    await syncProductionSecrets(names);
  } catch (error) {
    console.warn(
      "Warning: could not update Worker secrets.",
      error instanceof Error ? error.message : error,
    );
  }

  const projectRef = extractSupabaseProjectRef(supabaseUrl);
  if (projectRef && process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    try {
      await configureAuthUrls({
        projectRef,
        appUrl: names.appUrl,
        extraOrigins: productionAuthExtraOrigins(names.appUrl),
      });
    } catch (error) {
      console.warn(
        "Warning: could not update Supabase Auth URLs.",
        error instanceof Error ? error.message : error,
      );
    }
  } else if (!process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    console.warn(
      "Warning: SUPABASE_ACCESS_TOKEN unset — skipping Auth Site URL update.",
    );
  }

  await saveState({
    env: "production",
    appUrl: names.appUrl,
    supabaseUrl,
    supabaseProjectRef: projectRef,
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
    lastCopyFromStaging: copyFromStaging ? new Date().toISOString() : undefined,
    updatedAt: new Date().toISOString(),
  });

  console.log("");
  console.log(`Production deployed: ${names.appUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
