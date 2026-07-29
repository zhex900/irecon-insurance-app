import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { appEmailFooterImage } from "~/lib/db/schema";
import { DEFAULT_EMAIL_FOOTER_DATA_URI } from "~/lib/email/default-footer-data-uri";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 3 * 1024 * 1024;

function parseDataUri(dataUri: string): {
  contentType: string;
  base64: string;
} {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUri.trim());
  if (!match?.[1] || !match[2]) {
    throw new Error("Invalid footer image data URI.");
  }
  return { contentType: match[1], base64: match[2] };
}

export function dataUriToBytes(dataUri: string): {
  contentType: string;
  bytes: Uint8Array;
} {
  const { contentType, base64 } = parseDataUri(dataUri);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { contentType, bytes };
}

export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED.has(file.type)) {
      reject(new Error("Footer image must be a JPEG, PNG, WebP, or GIF."));
      return;
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      reject(new Error("Footer image must be between 1 byte and 3 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

export async function bufferToDataUri(
  buffer: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<string> {
  if (!ALLOWED.has(contentType)) {
    throw new Error("Footer image must be a JPEG, PNG, WebP, or GIF.");
  }
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_BYTES) {
    throw new Error("Footer image must be between 1 byte and 3 MB.");
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

/** Ensure the singleton row exists (seeded from the packaged default PNG). */
export async function ensureEmailFooterImage(
  updatedBy = "system",
): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ dataUri: appEmailFooterImage.dataUri })
    .from(appEmailFooterImage)
    .where(eq(appEmailFooterImage.id, 1))
    .limit(1);
  if (row?.dataUri?.startsWith("data:")) return row.dataUri;

  await db
    .insert(appEmailFooterImage)
    .values({
      id: 1,
      contentType: "image/png",
      dataUri: DEFAULT_EMAIL_FOOTER_DATA_URI,
      updatedBy,
      updatedWhen: new Date(),
    })
    .onConflictDoUpdate({
      target: appEmailFooterImage.id,
      set: {
        contentType: "image/png",
        dataUri: DEFAULT_EMAIL_FOOTER_DATA_URI,
        updatedBy,
        updatedWhen: new Date(),
      },
    });

  return DEFAULT_EMAIL_FOOTER_DATA_URI;
}

/** Data URI blob for `{{footerImage}}` merge / preview / send. */
export async function getEmailFooterDataUri(): Promise<string> {
  return ensureEmailFooterImage();
}

export async function saveEmailFooterDataUri(
  dataUri: string,
  updatedBy: string,
): Promise<string> {
  const { contentType } = parseDataUri(dataUri);
  if (!ALLOWED.has(contentType)) {
    throw new Error("Footer image must be a JPEG, PNG, WebP, or GIF.");
  }
  const { bytes } = dataUriToBytes(dataUri);
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error("Footer image must be between 1 byte and 3 MB.");
  }

  const db = getDb();
  await db
    .insert(appEmailFooterImage)
    .values({
      id: 1,
      contentType,
      dataUri,
      updatedBy,
      updatedWhen: new Date(),
    })
    .onConflictDoUpdate({
      target: appEmailFooterImage.id,
      set: {
        contentType,
        dataUri,
        updatedBy,
        updatedWhen: new Date(),
      },
    });

  return dataUri;
}

export async function saveEmailFooterFile(
  file: File,
  updatedBy: string,
): Promise<string> {
  const dataUri = await bufferToDataUri(await file.arrayBuffer(), file.type);
  return saveEmailFooterDataUri(dataUri, updatedBy);
}

/** Restore packaged default PNG into the database. */
export async function restoreDefaultEmailFooterImage(
  updatedBy: string,
): Promise<string> {
  return saveEmailFooterDataUri(DEFAULT_EMAIL_FOOTER_DATA_URI, updatedBy);
}
