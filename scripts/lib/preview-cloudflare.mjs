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
  run,
  uatAppWrangler,
  UAT_AVATARS_BUCKET,
  UAT_LIBRARY_BUCKET,
  webRoot,
  wranglerEnv,
  writeJsonc,
} from "./preview-env.mjs";
import { emptyR2Bucket, syncR2Bucket } from "./r2-s3-sync.mjs";

function configPath(envName, file) {
  return join(previewRoot, envName, file);
}

function wranglerEnvFile() {
  return process.env.WRANGLER_ENV_FILE?.trim() || join(webRoot, ".env.uat");
}

async function wrangler(args, { input } = {}) {
  await run("npx", ["wrangler", ...args, "--env-file", wranglerEnvFile()], {
    env: wranglerEnv(),
    input,
  });
}

async function wranglerCapture(args, { verbose = false, silent = false } = {}) {
  return capture(
    "npx",
    ["wrangler", ...args, "--env-file", wranglerEnvFile()],
    {
      env: verbose ? wranglerEnv({ WRANGLER_LOG: "log" }) : wranglerEnv(),
      silent,
    },
  );
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

export async function copyR2FromUat(names) {
  await ensureR2Buckets(names);
  console.log("→ Clearing destination R2 buckets…");
  await emptyR2Bucket(names.avatarsBucket);
  await emptyR2Bucket(names.libraryBucket);
  console.log(
    `→ Copying R2 objects from ${UAT_AVATARS_BUCKET} + ${UAT_LIBRARY_BUCKET}…`,
  );
  await syncR2Bucket(UAT_AVATARS_BUCKET, names.avatarsBucket);
  await syncR2Bucket(UAT_LIBRARY_BUCKET, names.libraryBucket);
  return {
    avatars: names.avatarsBucket,
    library: names.libraryBucket,
  };
}

/** @deprecated Use copyR2FromUat */
export const copyR2FromStaging = copyR2FromUat;

export async function emptyAndDeleteR2Buckets(names) {
  const targets = [names.avatarsBucket, names.libraryBucket];
  const existing = [];
  for (const bucket of targets) {
    if (await r2BucketExists(bucket)) existing.push(bucket);
  }

  if (existing.length === 0) {
    console.log("→ No preview R2 buckets found — skipping empty step");
  } else {
    const pendingDelete = [];
    for (const bucket of existing) {
      try {
        await wrangler(["r2", "bucket", "delete", bucket]);
        console.log(`✓ Deleted R2 bucket ${bucket}`);
      } catch {
        pendingDelete.push(bucket);
      }
    }

    if (pendingDelete.length > 0) {
      console.log("→ Emptying R2 buckets before delete…");
      try {
        for (const bucket of pendingDelete) {
          await emptyR2Bucket(bucket);
        }
      } catch (error) {
        console.warn(
          "Warning: could not empty R2 buckets via S3 API.",
          error instanceof Error ? error.message : error,
        );
      }
      for (const bucket of pendingDelete) {
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
  }

  // Legacy helper worker from older deploys (no longer deployed).
  await deleteWorker(`insurance-r2-copy-${names.slug}`);
}

function hyperdriveOriginLimitArgs(originConnectionLimit) {
  return ["--origin-connection-limit", String(originConnectionLimit)];
}

async function syncHyperdriveOriginLimit(id, originConnectionLimit) {
  console.log(
    `→ Setting Hyperdrive ${id} origin connection limit to ${originConnectionLimit}…`,
  );
  await wrangler([
    "hyperdrive",
    "update",
    id,
    ...hyperdriveOriginLimitArgs(originConnectionLimit),
  ]);
}

export async function ensureHyperdrive({
  names,
  connectionString,
  existingId,
  forceUpdate = false,
  originConnectionLimit,
}) {
  if (originConnectionLimit == null || originConnectionLimit <= 0) {
    throw new Error(
      "ensureHyperdrive requires originConnectionLimit (see infra-settings.mjs).",
    );
  }

  const existing = existingId || (await findHyperdriveId(names.hyperdriveName));

  if (existing && forceUpdate) {
    console.log(`→ Updating Hyperdrive ${existing} connection…`);
    await wrangler([
      "hyperdrive",
      "update",
      existing,
      "--connection-string",
      connectionString,
      ...hyperdriveOriginLimitArgs(originConnectionLimit),
    ]);
    console.log(`✓ Hyperdrive ${existing} updated`);
    return existing;
  }

  if (existing) {
    console.log(`→ Reusing Hyperdrive ${existing}`);
    await syncHyperdriveOriginLimit(existing, originConnectionLimit);
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
        ...hyperdriveOriginLimitArgs(originConnectionLimit),
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

export async function writeUatWranglerConfigs({
  names,
  supabaseUrl,
  hyperdriveId,
}) {
  const appPath = configPath("uat", "wrangler.app.jsonc");
  const pdfPath = configPath("uat", "wrangler.pdf.jsonc");
  const excelPath = configPath("uat", "wrangler.excel.jsonc");
  await writeJsonc(
    appPath,
    uatAppWrangler({ names, supabaseUrl, hyperdriveId }),
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

export async function syncPreviewSecrets({
  names,
  supabase,
  appUrl,
  turnstile = true,
}) {
  const secrets = {
    DATABASE_URL: supabase.transactionUrl,
    SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
    SUPABASE_SECRET_KEY: supabase.secretKey,
    APP_URL: appUrl,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SENTRY_DSN: process.env.SENTRY_DSN,
    ...(turnstile
      ? { TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY }
      : {}),
  };
  for (const [name, value] of Object.entries(secrets)) {
    await putWorkerSecret(names.appWorker, name, value ?? "");
  }
}

export async function deleteWorker(name) {
  try {
    await wranglerCapture(["delete", name, "--force"], { silent: true });
    console.log(`✓ Deleted Worker ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/10090|does not exist/i.test(message)) return;
    console.warn(`Warning: could not delete Worker ${name}.`, message);
  }
}

export async function deletePreviewWorkers(names) {
  // App first — it holds service bindings to PDF/Excel.
  await deleteWorker(names.appWorker);
  await deleteWorker(names.pdfWorker);
  await deleteWorker(names.excelWorker);
}
