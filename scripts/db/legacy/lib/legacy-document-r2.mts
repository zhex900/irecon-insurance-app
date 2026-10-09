/**
 * List / probe legacy policy document objects in R2 (S3-compatible API).
 */
import { execFileSync } from "node:child_process";

import { r2S3Config } from "../../../../deployment/lib/r2-s3-sync.mjs";

function awsEnv() {
  const { endpoint, accessKeyId, secretAccessKey } = r2S3Config();
  return {
    env: {
      ...process.env,
      AWS_ACCESS_KEY_ID: accessKeyId,
      AWS_SECRET_ACCESS_KEY: secretAccessKey,
      AWS_REGION: "auto",
      AWS_EC2_METADATA_DISABLED: "true",
    },
    endpoint,
  };
}

function ensureAwsCli() {
  try {
    execFileSync("aws", ["--version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "AWS CLI is required to list R2 objects. Install it or pass --skip-r2.",
    );
  }
}

/**
 * Parse one line of `aws s3 ls --recursive` output.
 * Format: DATE TIME SIZE KEY (KEY may contain spaces, e.g. legacy PDF names).
 */
export function parseAwsS3LsLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+\d+\s+(.+)$/,
  );
  return match?.[1] ?? null;
}

/** `{policyDocumentId}-{filename}` tail of object keys for legacy uploads. */
export function buildLegacyDocumentR2TailIndex(
  keys: Iterable<string>,
): Set<string> {
  const tails = new Set<string>();
  for (const key of keys) {
    const slash = key.lastIndexOf("/");
    const tail = slash >= 0 ? key.slice(slash + 1) : key;
    if (tail) tails.add(tail);
  }
  return tails;
}

export function legacyDocumentR2Tail(
  policyDocumentId: number,
  filename: string,
): string {
  const safe = filename.replace(/[/\\]/g, "_").trim();
  return `${policyDocumentId}-${safe}`;
}

export function isLegacyDocumentInR2(
  r2Key: string,
  doc: { policyDocumentId: number; filename: string },
  fullKeys: Set<string>,
  tailKeys: Set<string>,
): boolean {
  if (fullKeys.has(r2Key)) return true;
  return tailKeys.has(legacyDocumentR2Tail(doc.policyDocumentId, doc.filename));
}

/** All object keys under `prefix` (e.g. `policies/`). */
export function listR2ObjectKeys(bucket: string, prefix = ""): Set<string> {
  ensureAwsCli();
  const { env, endpoint } = awsEnv();
  const args = [
    "s3",
    "ls",
    prefix ? `s3://${bucket}/${prefix}` : `s3://${bucket}/`,
    "--recursive",
    "--endpoint-url",
    endpoint,
  ];

  let stdout: string;
  try {
    stdout = execFileSync("aws", args, {
      encoding: "utf8",
      env,
      maxBuffer: 512 * 1024 * 1024,
    });
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    throw new Error(
      `Failed to list R2 bucket ${bucket}: ${err.stderr ?? err.message ?? error}`,
    );
  }

  const keys = new Set<string>();
  for (const line of stdout.split("\n")) {
    const key = parseAwsS3LsLine(line);
    if (key) keys.add(key);
  }
  return keys;
}

export function r2ObjectExists(
  bucket: string,
  key: string,
  knownKeys?: Set<string>,
): boolean {
  if (knownKeys) return knownKeys.has(key);
  ensureAwsCli();
  const { env, endpoint } = awsEnv();
  try {
    execFileSync(
      "aws",
      [
        "s3api",
        "head-object",
        "--bucket",
        bucket,
        "--key",
        key,
        "--endpoint-url",
        endpoint,
      ],
      { stdio: "ignore", env },
    );
    return true;
  } catch {
    return false;
  }
}
