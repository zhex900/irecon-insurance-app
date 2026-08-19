/**
 * Upload legacy policy PDFs to R2 via the S3-compatible API (AWS CLI).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { r2S3Config } from "../../infra/lib/r2-s3-sync.mjs";

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
    "insurance-app-library-documents"
  );
}

export function uploadPolicyDocumentToR2(
  options: UploadPolicyDocumentOptions,
): void {
  const bucket = options.bucket ?? policyDocumentsBucket();
  const { endpoint, accessKeyId, secretAccessKey } = r2S3Config();
  ensureAwsCli();

  const bytes = readFileSync(options.localPath);
  if (bytes.length === 0) {
    throw new Error(`Empty file: ${options.localPath}`);
  }

  execFileSync(
    "aws",
    [
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
}

export function hasR2Credentials(): boolean {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID?.trim() &&
    process.env.R2_SECRET_ACCESS_KEY?.trim() &&
    process.env.R2_S3_ENDPOINT?.trim(),
  );
}
