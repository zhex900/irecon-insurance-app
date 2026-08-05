import type { R2BucketLike } from "~/lib/cloudflare.server";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf"]);
const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

export function hasPdfHeader(bytes: Uint8Array): boolean {
  const searchLength = Math.min(bytes.length, 1024);
  for (let offset = 0; offset <= searchLength - PDF_HEADER.length; offset++) {
    if (PDF_HEADER.every((byte, index) => bytes[offset + index] === byte)) {
      return true;
    }
  }
  return false;
}

export function applyPrivatePdfResponseHeaders(
  headers: Headers,
  filename: string,
): void {
  const safeFilename = filename.replace(/["\r\n]/g, "");
  headers.set("Content-Type", "application/pdf");
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Content-Disposition", `inline; filename="${safeFilename}"`);
  headers.set("Content-Security-Policy", "sandbox");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("X-Content-Type-Options", "nosniff");
}

export function libraryDocumentObjectKey(filename: string) {
  const safe = filename.replace(/[/\\]/g, "_").trim();
  return `library/${safe}`;
}

export async function putLibraryDocumentPdf(
  bucket: R2BucketLike,
  filename: string,
  file: File,
) {
  if (!ALLOWED.has(file.type) || !filename.toLowerCase().endsWith(".pdf")) {
    throw new Error("Library documents must be PDF files.");
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error("PDF must be between 1 byte and 50 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfHeader(bytes.subarray(0, 1024))) {
    throw new Error("The selected file does not contain a valid PDF header.");
  }

  const key = libraryDocumentObjectKey(filename);
  await bucket.put(key, bytes, {
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
