#!/usr/bin/env node
/**
 * Build + deploy insurance-app-staging to Cloudflare Workers.
 *
 * DATABASE_URL must be set in the environment (staging Supabase pooler URL).
 * VITE_APP_VERSION defaults to staging-<short-commit> when unset.
 *
 * Usage:
 *   npm run deploy:staging
 *   node --env-file=.env.staging scripts/deploy-staging.mjs
 *   node --env-file=.env.staging scripts/deploy-staging.mjs --secret-only
 */
import { spawn, execFileSync } from "node:child_process";
import { readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const workerName = "insurance-app-staging";
const secretOnly = process.argv.includes("--secret-only");
const skipBuild = process.argv.includes("--skip-build");

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

function resolveStagingAppVersion() {
  const explicit = process.env.VITE_APP_VERSION?.trim();
  if (explicit) return explicit;
  try {
    const hash = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: webRoot,
      encoding: "utf8",
    }).trim();
    return `staging-${hash}`;
  } catch {
    return "staging-unknown";
  }
}

function assertStagingDatabaseUrl(url) {
  if (!url?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Export it or use --env-file=.env.staging (see .env.staging.example).",
    );
  }
  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    throw new Error(
      "DATABASE_URL points at localhost. Use the staging Supabase pooler URL.",
    );
  }
  if (!url.includes("supabase.com") && !url.includes("tjnsygunohylofihoksl")) {
    console.warn(
      "Warning: DATABASE_URL does not look like the insurance-app-staging Supabase project.",
    );
  }
}

async function putSecret(name, value) {
  if (!value?.trim()) {
    console.warn(`Warning: ${name} is empty — skipping secret put.`);
    return false;
  }
  console.log(`→ Syncing ${name} secret for Worker "${workerName}"…`);
  await run("npx", ["wrangler", "secret", "put", name, "--name", workerName], {
    input: value,
  });
  console.log(`✓ ${name} secret updated`);
  return true;
}

async function syncWorkerSecrets() {
  const databaseUrl = process.env.DATABASE_URL;
  assertStagingDatabaseUrl(databaseUrl);

  await putSecret("DATABASE_URL", databaseUrl);
  await putSecret("SUPABASE_ANON_KEY", process.env.SUPABASE_ANON_KEY);
  await putSecret(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  await putSecret(
    "APP_URL",
    process.env.APP_URL?.trim() ||
      "https://insurance-app-staging.zhex900.workers.dev",
  );
  await putSecret("RESEND_API_KEY", process.env.RESEND_API_KEY);
  await putSecret("EMAIL_FROM", process.env.EMAIL_FROM);
  await putSecret("EMAIL_REPLY_TO", process.env.EMAIL_REPLY_TO);
  await putSecret("SENTRY_DSN", process.env.SENTRY_DSN);
  await putSecret("TURNSTILE_SECRET_KEY", process.env.TURNSTILE_SECRET_KEY);

  if (!process.env.SUPABASE_ANON_KEY?.trim()) {
    throw new Error(
      "SUPABASE_ANON_KEY is required for staging login. Add it to .env.staging (Supabase → Project Settings → API).",
    );
  }
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.EMAIL_FROM?.trim()) {
    console.warn(
      "Warning: RESEND_API_KEY / EMAIL_FROM empty — policy document email will fail on staging until set.",
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

/** Remove *.map under a build tree so maps are never shipped with the Worker. */
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

/**
 * Route resource stubs / runtime helpers have no Vite .map. Ignore them so
 * sentry-cli inject/upload stay quiet (gitignore-style patterns).
 */
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
    // Never ship .map files with the Worker (upload may have failed).
    // Client maps go to Sentry; server maps are build-only and would bloat deploy.
    const removed = await deleteSourceMaps(join(webRoot, "build"));
    if (removed > 0) {
      console.log(`✓ Removed ${removed} source map(s) before deploy`);
    }
  }
}

async function main() {
  assertStagingDatabaseUrl(process.env.DATABASE_URL);

  if (secretOnly) {
    await syncWorkerSecrets();
    console.log("Done (--secret-only).");
    return;
  }

  const appVersion = resolveStagingAppVersion();

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

  // The application version references this service binding, so deploy the
  // private renderer first and only then publish the application Worker.
  console.log("→ Deploying document Worker…");
  await run("npx", ["wrangler", "deploy", "--config", "wrangler.pdf.jsonc"]);
  console.log("✓ PDF Worker deployed");

  console.log("→ Deploying application Worker…");
  await run("npx", ["wrangler", "deploy"]);
  console.log("✓ Deployed https://insurance-app-staging.zhex900.workers.dev");

  // Sync secrets after deploy so rollbacks / versioned Workers don't block secret put.
  try {
    await syncWorkerSecrets();
  } catch (error) {
    console.warn(
      "Warning: could not update Worker secrets.",
      error instanceof Error ? error.message : error,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
