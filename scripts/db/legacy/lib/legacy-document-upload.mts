/**
 * Upload legacy policy PDFs to R2 via the S3-compatible API (AWS CLI).
 */
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  r2S3Config,
  r2BucketExists,
} from "../../../../deployment/lib/r2-s3-sync.mjs";
import { LEGACY_LIBRARY_BUCKET } from "../../../../deployment/lib/preview-env.mjs";

const execFileAsync = promisify(execFile);

const R2_PUT_MAX_ATTEMPTS = 6;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isR2RateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("serviceunavailable") ||
    lower.includes("reduce your concurrent request rate") ||
    lower.includes("slow down") ||
    lower.includes("request limit")
  );
}

function ensureAwsCli() {
  try {
    execFileSync("aws", ["--version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "AWS CLI is required for R2 uploads. Install it or pass --skip-r2.",
    );
  }
}

export type UploadPolicyDocumentOptions = {
  localPath: string;
  r2Key: string;
  bucket?: string;
};

export function policyDocumentsBucket(): string {
  return (
    process.env.R2_POLICY_DOCUMENTS_BUCKET?.trim() ||
    "insurance-app-library-documents-uat"
  );
}

/** Buckets that may contain legacy uploads (env bucket + legacy shared). */
export function policyDocumentsBucketsForClear(buckets?: string[]): string[] {
  const primary = buckets?.length ? buckets : [policyDocumentsBucket()];
  return [...new Set([...primary, LEGACY_LIBRARY_BUCKET])];
}

async function deletePolicyDocumentsFromBucket(
  keys: string[],
  bucket: string,
): Promise<number> {
  const { endpoint, accessKeyId, secretAccessKey } = r2S3Config();
  let removed = 0;
  for (let i = 0; i < keys.length; i += R2_DELETE_BATCH_SIZE) {
    const batch = keys.slice(i, i + R2_DELETE_BATCH_SIZE);
    execFileSync(
      "aws",
      [
        "s3api",
        "delete-objects",
        "--bucket",
        bucket,
        "--delete",
        JSON.stringify({
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        }),
        "--endpoint-url",
        endpoint,
      ],
      {
        stdio: "pipe",
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: accessKeyId,
          AWS_SECRET_ACCESS_KEY: secretAccessKey,
          AWS_REGION: "auto",
          AWS_EC2_METADATA_DISABLED: "true",
        },
      },
    );
    removed += batch.length;
    if (
      removed === batch.length ||
      removed % 1000 === 0 ||
      removed === keys.length
    ) {
      console.log(`  R2 delete progress ${removed}/${keys.length} (${bucket})`);
    }
  }
  return removed;
}

function awsPutObjectEnv(accessKeyId: string, secretAccessKey: string) {
  return {
    ...process.env,
    AWS_ACCESS_KEY_ID: accessKeyId,
    AWS_SECRET_ACCESS_KEY: secretAccessKey,
    AWS_REGION: "auto",
    AWS_EC2_METADATA_DISABLED: "true",
  };
}

export async function uploadPolicyDocumentToR2(
  options: UploadPolicyDocumentOptions,
): Promise<void> {
  const bucket = options.bucket ?? policyDocumentsBucket();
  const { endpoint, accessKeyId, secretAccessKey } = r2S3Config();
  ensureAwsCli();

  const bytes = readFileSync(options.localPath);
  if (bytes.length === 0) {
    throw new Error(`Empty file: ${options.localPath}`);
  }

  const args = [
    "s3api",
    "put-object",
    "--bucket",
    bucket,
    "--key",
    options.r2Key,
    "--body",
    options.localPath,
    "--content-type",
    "application/pdf",
    "--endpoint-url",
    endpoint,
  ];
  const execOptions = {
    env: awsPutObjectEnv(accessKeyId, secretAccessKey),
    maxBuffer: 10 * 1024 * 1024,
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= R2_PUT_MAX_ATTEMPTS; attempt++) {
    try {
      await execFileAsync("aws", args, execOptions);
      return;
    } catch (error) {
      lastError = error;
      const stderr =
        error && typeof error === "object" && "stderr" in error
          ? String((error as { stderr?: Buffer }).stderr ?? "")
          : String(error);
      if (!isR2RateLimitError(stderr) || attempt === R2_PUT_MAX_ATTEMPTS) {
        throw error;
      }
      const delayMs = Math.min(30_000, 1000 * 2 ** (attempt - 1));
      console.warn(
        `  R2 rate limit on put-object (attempt ${attempt}/${R2_PUT_MAX_ATTEMPTS}), retry in ${delayMs}ms…`,
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

export async function uploadPolicyDocumentBytesToR2(
  options: Omit<UploadPolicyDocumentOptions, "localPath"> & {
    bytes: Uint8Array;
  },
): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "irecon-policy-doc-"));
  const localPath = join(dir, "upload.pdf");
  try {
    writeFileSync(localPath, options.bytes);
    await uploadPolicyDocumentToR2({
      localPath,
      r2Key: options.r2Key,
      bucket: options.bucket,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function hasR2Credentials(): boolean {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID?.trim() &&
    process.env.R2_SECRET_ACCESS_KEY?.trim() &&
    process.env.R2_S3_ENDPOINT?.trim(),
  );
}

const R2_DELETE_BATCH_SIZE = 100;

export async function deletePolicyDocumentsFromR2(
  keys: string[],
  buckets?: string[],
): Promise<number> {
  ensureAwsCli();
  const targets = policyDocumentsBucketsForClear(buckets);
  const existing: string[] = [];
  for (const bucket of targets) {
    if (await r2BucketExists(bucket)) existing.push(bucket);
  }

  if (existing.length === 0) {
    console.warn(
      `Warning: no R2 buckets found (${targets.join(", ")}) — skipping R2 delete.`,
    );
    return 0;
  }

  const skipped = targets.filter((bucket) => !existing.includes(bucket));
  if (skipped.length > 0) {
    console.warn(
      `Warning: skipping missing R2 bucket(s): ${skipped.join(", ")}`,
    );
  }

  let removed = 0;
  for (const bucket of existing) {
    console.log(`Removing ${keys.length} object(s) from R2 bucket ${bucket}…`);
    removed = Math.max(
      removed,
      await deletePolicyDocumentsFromBucket(keys, bucket),
    );
  }
  return removed;
}
