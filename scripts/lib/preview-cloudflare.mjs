/**
 * Cloudflare resources for a preview env: R2 copy, Hyperdrive, Workers, secrets.
 */
import { join } from "node:path";

import {
  capture,
  extractHyperdriveId,
  previewAppWrangler,
  previewExcelWrangler,
  previewPdfWrangler,
  previewRoot,
  r2HelperWrangler,
  randomSecret,
  run,
  STAGING_AVATARS_BUCKET,
  STAGING_LIBRARY_BUCKET,
  wranglerEnv,
  writeJsonc,
} from "./preview-env.mjs";

function configPath(envName, file) {
  return join(previewRoot, envName, file);
}

async function wrangler(args, { input } = {}) {
  await run("npx", ["wrangler", ...args], {
    env: wranglerEnv(),
    input,
  });
}

async function wranglerCapture(args, { verbose = false, silent = false } = {}) {
  return capture("npx", ["wrangler", ...args], {
    env: verbose ? wranglerEnv({ WRANGLER_LOG: "log" }) : wranglerEnv(),
    silent,
  });
}

async function r2BucketExists(bucket) {
  try {
    await wranglerCapture(["r2", "bucket", "info", bucket, "--json"], {
      silent: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function ensureR2Buckets(names) {
  for (const bucket of [names.avatarsBucket, names.libraryBucket]) {
    if (await r2BucketExists(bucket)) {
      console.log(`→ R2 bucket ${bucket} already exists`);
      continue;
    }
    await wranglerCapture(["r2", "bucket", "create", bucket]);
    console.log(`✓ R2 bucket ${bucket}`);
  }
}

async function invokeR2Helper(names, { token, mode, bucket }) {
  let cursor = "";
  let total = 0;
  const field = mode === "empty" ? "deleted" : "copied";
  for (;;) {
    const url = new URL(names.r2HelperUrl);
    url.searchParams.set("token", token);
    url.searchParams.set("mode", mode);
    url.searchParams.set("bucket", bucket);
    if (cursor) url.searchParams.set("cursor", cursor);
    const body = await fetchR2Helper(url, token);
    total += Number(body[field] ?? 0);
    if (body.done) break;
    cursor = body.cursor;
    if (!cursor) break;
  }
  return total;
}

async function fetchR2Helper(url, token) {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { "x-copy-token": token },
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 523 || res.status === 530 || res.status === 404) {
        throw new Error(`DNS/not ready (${res.status})`);
      }
      if (!res.ok) {
        throw new Error(
          `R2 helper failed (${res.status}): ${JSON.stringify(body)}`,
        );
      }
      return body;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function runR2Helper(names, { emptyOnly, buckets, buildWrangler, wranglerPath }) {
  const token = randomSecret(16);
  await writeJsonc(
    wranglerPath,
    buildWrangler({ emptyOnly, copyToken: token }),
  );
  console.log(
    `→ Deploying R2 helper Worker ${names.r2HelperWorker} (${emptyOnly ? "empty" : "copy"})…`,
  );
  await wrangler(["deploy", "--config", wranglerPath]);
  try {
    const result = {};
    for (const bucket of buckets) {
      result[bucket] = await invokeR2Helper(names, {
        token,
        mode: emptyOnly ? "empty" : "copy",
        bucket,
      });
      console.log(
        `✓ R2 ${emptyOnly ? "emptied" : "copied"} ${bucket}: ${result[bucket]} object(s)`,
      );
    }
    return result;
  } finally {
    await deleteWorker(names.r2HelperWorker);
  }
}

export async function copyR2FromStaging(names, options = {}) {
  const wranglerPath =
    options.wranglerPath ?? configPath(names.label, "wrangler.r2.jsonc");
  const buildWrangler =
    options.buildWrangler ??
    ((params) => r2HelperWrangler(names, params));
  await ensureR2Buckets(names);
  console.log("→ Clearing destination R2 buckets…");
  await runR2Helper(names, {
    emptyOnly: true,
    buckets: ["avatars", "library"],
    wranglerPath,
    buildWrangler,
  });
  console.log(
    `→ Copying R2 objects from ${STAGING_AVATARS_BUCKET} + ${STAGING_LIBRARY_BUCKET}…`,
  );
  return runR2Helper(names, {
    emptyOnly: false,
    buckets: ["avatars", "library"],
    wranglerPath,
    buildWrangler,
  });
}

export async function emptyAndDeleteR2Buckets(names, options = {}) {
  const wranglerPath =
    options.wranglerPath ?? configPath(names.label, "wrangler.r2.jsonc");
  const buildWrangler =
    options.buildWrangler ??
    ((params) => r2HelperWrangler(names, params));
  try {
    await runR2Helper(names, {
      emptyOnly: true,
      buckets: ["avatars", "library"],
      wranglerPath,
      buildWrangler,
    });
  } catch (error) {
    console.warn(
      "Warning: could not empty R2 buckets via helper.",
      error instanceof Error ? error.message : error,
    );
  }
  for (const bucket of [names.avatarsBucket, names.libraryBucket]) {
    try {
      await wrangler(["r2", "bucket", "delete", bucket]);
      console.log(`✓ Deleted R2 bucket ${bucket}`);
    } catch (error) {
      console.warn(
        `Warning: could not delete R2 bucket ${bucket}.`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export async function ensureHyperdrive({
  names,
  connectionString,
  existingId,
}) {
  if (existingId) {
    console.log(`→ Reusing Hyperdrive ${existingId}`);
    return existingId;
  }

  const existing = await findHyperdriveId(names.hyperdriveName);
  if (existing) {
    console.log(`→ Reusing Hyperdrive ${existing}`);
    return existing;
  }

  console.log(`→ Creating Hyperdrive ${names.hyperdriveName}…`);
  try {
    const { stdout, stderr } = await wranglerCapture(
      [
        "hyperdrive",
        "create",
        names.hyperdriveName,
        "--connection-string",
        connectionString,
      ],
      { verbose: true },
    );
    const id =
      extractHyperdriveId(`${stdout}\n${stderr}`) ||
      (await findHyperdriveId(names.hyperdriveName));
    if (!id) {
      throw new Error("Could not parse Hyperdrive id from wrangler output.");
    }
    console.log(`✓ Hyperdrive ${id}`);
    return id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists|duplicate|2017/i.test(message)) throw error;
    const id = await findHyperdriveId(names.hyperdriveName);
    if (!id) throw error;
    console.log(`→ Reusing existing Hyperdrive ${id}`);
    return id;
  }
}

export async function findHyperdriveId(name) {
  const { stdout, stderr } = await wranglerCapture(["hyperdrive", "list"], {
    verbose: true,
  });
  const lines = `${stdout}\n${stderr}`.split("\n");
  for (const line of lines) {
    if (!line.includes(name)) continue;
    const match = line.match(/[a-f0-9]{32}/i);
    if (match) return match[0];
  }
  return null;
}

export async function deleteHyperdrive(id) {
  if (!id) return;
  console.log(`→ Deleting Hyperdrive ${id}…`);
  try {
    await wrangler(["hyperdrive", "delete", id]);
    console.log("✓ Hyperdrive deleted");
  } catch (error) {
    console.warn(
      "Warning: could not delete Hyperdrive.",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function writePreviewWranglerConfigs({
  names,
  supabaseUrl,
  hyperdriveId,
}) {
  const appPath = configPath(names.label, "wrangler.app.jsonc");
  const pdfPath = configPath(names.label, "wrangler.pdf.jsonc");
  const excelPath = configPath(names.label, "wrangler.excel.jsonc");
  await writeJsonc(
    appPath,
    previewAppWrangler({ names, supabaseUrl, hyperdriveId }),
  );
  await writeJsonc(pdfPath, previewPdfWrangler(names));
  await writeJsonc(excelPath, previewExcelWrangler(names));
  return { appPath, pdfPath, excelPath };
}

export async function deployPreviewWorkers({ names, configs }) {
  console.log("→ Deploying Excel Worker…");
  await wrangler(["deploy", "--config", configs.excelPath]);
  console.log("→ Deploying PDF Worker…");
  await wrangler(["deploy", "--config", configs.pdfPath]);
  console.log("→ Deploying application Worker…");
  await wrangler(["deploy", "--config", configs.appPath]);
  console.log(`✓ Deployed ${names.appUrl}`);
}

export async function putWorkerSecret(workerName, name, value) {
  if (!value?.trim()) {
    console.warn(`Warning: ${name} is empty — skipping secret put.`);
    return false;
  }
  console.log(`→ Syncing ${name} secret for Worker "${workerName}"…`);
  await wrangler(["secret", "put", name, "--name", workerName], {
    input: value,
  });
  return true;
}

export async function syncPreviewSecrets({ names, supabase, appUrl }) {
  const secrets = {
    DATABASE_URL: supabase.transactionUrl,
    SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
    SUPABASE_SECRET_KEY: supabase.secretKey,
    APP_URL: appUrl,
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
}

export async function deleteWorker(name) {
  try {
    await wrangler(["delete", name, "--force"]);
    console.log(`✓ Deleted Worker ${name}`);
  } catch (error) {
    console.warn(
      `Warning: could not delete Worker ${name}.`,
      error instanceof Error ? error.message : error,
    );
  }
}

export async function deletePreviewWorkers(names) {
  // App first — it holds service bindings to PDF/Excel.
  await deleteWorker(names.appWorker);
  await deleteWorker(names.pdfWorker);
  await deleteWorker(names.excelWorker);
  await deleteWorker(names.r2HelperWorker);
}
