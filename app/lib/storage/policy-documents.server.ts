import type { R2BucketLike } from "~/lib/cloudflare.server";
import { hasPdfHeader } from "~/lib/storage/library-documents.server";

const MAX_BYTES = 50 * 1024 * 1024;

/** R2 object key for a policy-owned PDF (generated or legacy-migrated). */
export function policyDocumentObjectKey(
  policyId: string,
  documentId: string,
  filename: string,
): string {
  const safe = filename.replace(/[/\\]/g, "_").trim();
  return `policies/${policyId}/${documentId}-${safe}`;
}

export async function putPolicyDocumentPdf(
  bucket: R2BucketLike,
  r2Key: string,
  bytes: Uint8Array,
): Promise<void> {
  if (bytes.length <= 0 || bytes.length > MAX_BYTES) {
    throw new Error("PDF must be between 1 byte and 50 MB.");
  }
  if (!hasPdfHeader(bytes.subarray(0, Math.min(bytes.length, 1024)))) {
    throw new Error("Generated document is not a valid PDF.");
  }

  await bucket.put(r2Key, bytes, {
    httpMetadata: {
      contentType: "application/pdf",
      cacheControl: "private, max-age=3600",
    },
  });
}
