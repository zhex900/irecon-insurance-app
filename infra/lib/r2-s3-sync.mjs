/**
 * R2 bucket sync via the S3-compatible API (aws s3 sync / rm).
 *
 * Requires R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT in the environment.
 */
import { capture, run } from "./preview-env.mjs";

/** Normalize Cloudflare R2 S3 API endpoint (full URL from dashboard, or bare account id). */
export function normalizeR2S3Endpoint(raw) {
  const value = raw.trim().replace(/\/$/, "");
  if (/^https:\/\//i.test(value)) return value;
  return `https://${value}.r2.cloudflarestorage.com`;
}

export function r2S3Config() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const endpointRaw = process.env.R2_S3_ENDPOINT?.trim();
  if (!accessKeyId || !secretAccessKey || !endpointRaw) {
    throw new Error(
      "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_S3_ENDPOINT are required for R2 sync.",
    );
  }
  return {
    accessKeyId,
    secretAccessKey,
    endpoint: normalizeR2S3Endpoint(endpointRaw),
  };
}

function awsEnv(config) {
  return {
    ...process.env,
    AWS_ACCESS_KEY_ID: config.accessKeyId,
    AWS_SECRET_ACCESS_KEY: config.secretAccessKey,
    AWS_REGION: "auto",
    AWS_EC2_METADATA_DISABLED: "true",
  };
}

async function ensureAwsCli() {
  try {
    await capture("aws", ["--version"], { silent: true });
  } catch {
    throw new Error(
      "AWS CLI is required for R2 sync. Install it locally or add an AWS CLI setup step in CI.",
    );
  }
}

async function runAws(args) {
  const config = r2S3Config();
  await ensureAwsCli();
  await run("aws", args, {
    env: awsEnv(config),
  });
}

/**
 * Copy all objects from one R2 bucket to another (S3 → S3 within R2).
 */
export async function syncR2Bucket(sourceBucket, destBucket) {
  const { endpoint } = r2S3Config();
  console.log(`→ Syncing R2 s3://${sourceBucket}/ → s3://${destBucket}/…`);
  await runAws([
    "s3",
    "sync",
    `s3://${sourceBucket}/`,
    `s3://${destBucket}/`,
    "--endpoint-url",
    endpoint,
    "--only-show-errors",
  ]);
  console.log(`✓ R2 sync complete (${sourceBucket} → ${destBucket})`);
}

/** Remove all objects from an R2 bucket. */
export async function emptyR2Bucket(bucket) {
  const { endpoint } = r2S3Config();
  console.log(`→ Emptying R2 bucket ${bucket}…`);
  await runAws([
    "s3",
    "rm",
    `s3://${bucket}/`,
    "--recursive",
    "--endpoint-url",
    endpoint,
    "--only-show-errors",
  ]);
  console.log(`✓ Emptied R2 bucket ${bucket}`);
}
