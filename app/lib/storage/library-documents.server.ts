import type { R2BucketLike } from "~/lib/cloudflare.server";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf"]);

export function libraryDocumentObjectKey(filename: string) {
  const safe = filename.replace(/[/\\]/g, "_").trim();
  return `library/${safe}`;
}

export async function putLibraryDocumentPdf(
  bucket: R2BucketLike,
  filename: string,
  file: File,
) {
  const type = file.type || "application/pdf";
  if (!ALLOWED.has(type) && !filename.toLowerCase().endsWith(".pdf")) {
    throw new Error("Library documents must be PDF files.");
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error("PDF must be between 1 byte and 50 MB.");
  }

  const key = libraryDocumentObjectKey(filename);
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: "application/pdf",
      cacheControl: "private, max-age=3600",
    },
  });
  return key;
}

export async function deleteLibraryDocumentPdf(
  bucket: R2BucketLike,
  r2Key: string,
) {
  await bucket.delete(r2Key);
}

export async function getLibraryDocumentObject(
  bucket: R2BucketLike,
  r2Key: string,
) {
  return bucket.get(r2Key);
}
