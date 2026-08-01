import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { R2BucketLike } from "~/lib/cloudflare.server";
import { getDb } from "~/lib/db/client";
import { libraryDocument } from "~/lib/db/schema";
import {
  DOCUMENT_LABEL_MAX_LENGTH,
  documentLabelFromFilename,
  normalizeDocumentLabel,
} from "~/lib/documents/document-label";
import type { LibraryDocumentRecord } from "~/lib/library-documents";
import {
  deleteLibraryDocumentPdf,
  putLibraryDocumentPdf,
} from "~/lib/storage/library-documents.server";

export type { LibraryDocumentRecord } from "~/lib/library-documents";
export {
  libraryDocumentMatchesPolicy,
  libraryDocumentPublicPath,
} from "~/lib/library-documents";

function mapRow(
  row: typeof libraryDocument.$inferSelect,
): LibraryDocumentRecord {
  return {
    libraryDocumentId: row.libraryDocumentId,
    filename: row.filename,
    displayName: row.displayName,
    r2Key: row.r2Key,
    contentType: row.contentType,
    sizeBytes: Number(row.sizeBytes),
    attachRule: row.attachRule,
    createdWhen: row.createdWhen.toISOString(),
    createdBy: row.createdBy,
    updatedWhen: row.updatedWhen.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export const updateLibraryDocumentLabelInputSchema = z.object({
  id: z.number().int().positive(),
  label: z.string().max(DOCUMENT_LABEL_MAX_LENGTH),
});

export async function listLibraryDocuments(): Promise<LibraryDocumentRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(libraryDocument)
    .orderBy(asc(libraryDocument.filename));
  return rows.map(mapRow);
}

export async function getLibraryDocumentById(
  id: number,
): Promise<LibraryDocumentRecord | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(libraryDocument)
    .where(eq(libraryDocument.libraryDocumentId, id))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function getLibraryDocumentByFilename(
  filename: string,
): Promise<LibraryDocumentRecord | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(libraryDocument)
    .where(eq(libraryDocument.filename, filename))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function uploadLibraryDocument(
  bucket: R2BucketLike,
  file: File,
  actorEmail: string,
  attachRule = "",
): Promise<LibraryDocumentRecord> {
  const filename = file.name.trim();
  if (!filename) throw new Error("Filename is required.");
  if (!filename.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are allowed.");
  }

  // Stamp-duty exemption PDFs stay NSW-only for pack attachment.
  const resolvedRule =
    attachRule || (/stamp\s*duty/i.test(filename) ? "state:2" : "");

  const r2Key = await putLibraryDocumentPdf(bucket, filename, file);
  const now = new Date();
  const displayName = documentLabelFromFilename(filename);
  const db = getDb();

  const existing = await getLibraryDocumentByFilename(filename);
  if (existing) {
    const [row] = await db
      .update(libraryDocument)
      .set({
        // Keep an existing custom label on replace.
        r2Key,
        contentType: "application/pdf",
        sizeBytes: file.size,
        attachRule: resolvedRule || existing.attachRule,
        updatedWhen: now,
        updatedBy: actorEmail,
      })
      .where(eq(libraryDocument.libraryDocumentId, existing.libraryDocumentId))
      .returning();
    return mapRow(row);
  }

  const [row] = await db
    .insert(libraryDocument)
    .values({
      filename,
      displayName,
      r2Key,
      contentType: "application/pdf",
      sizeBytes: file.size,
      attachRule: resolvedRule,
      createdWhen: now,
      createdBy: actorEmail,
      updatedWhen: now,
      updatedBy: actorEmail,
    })
    .returning();
  return mapRow(row);
}

export async function updateLibraryDocumentLabel(
  input: z.infer<typeof updateLibraryDocumentLabelInputSchema>,
  actorEmail: string,
): Promise<LibraryDocumentRecord | null> {
  const parsed = updateLibraryDocumentLabelInputSchema.parse(input);
  const existing = await getLibraryDocumentById(parsed.id);
  if (!existing) return null;

  const displayName = normalizeDocumentLabel(parsed.label, existing.filename);
  const db = getDb();
  const [row] = await db
    .update(libraryDocument)
    .set({
      displayName,
      updatedWhen: new Date(),
      updatedBy: actorEmail,
    })
    .where(eq(libraryDocument.libraryDocumentId, parsed.id))
    .returning();
  return row ? mapRow(row) : null;
}

export async function deleteLibraryDocument(
  bucket: R2BucketLike,
  id: number,
): Promise<LibraryDocumentRecord | null> {
  const existing = await getLibraryDocumentById(id);
  if (!existing) return null;

  await deleteLibraryDocumentPdf(bucket, existing.r2Key);
  const db = getDb();
  await db
    .delete(libraryDocument)
    .where(eq(libraryDocument.libraryDocumentId, id));
  return existing;
}
