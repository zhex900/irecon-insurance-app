import type { FileMetadata, FileWithPreview } from "~/hooks/use-file-upload";
import {
  libraryDocumentPublicPath,
  type LibraryDocumentRecord,
} from "~/lib/documents/library-documents";

export type CoverTypeOption = {
  coverTypeId: number;
  name: string;
};

export type UploadItem = FileWithPreview & {
  status: "uploading" | "completed" | "error";
  error?: string;
  libraryDocumentId?: number;
};

export type LibraryDocumentActionData =
  | {
      ok: true;
      intent: "upload";
      clientId: string;
      document: LibraryDocumentRecord;
    }
  | { ok: true; intent: "delete"; id: number }
  | {
      ok: true;
      intent: "update-label";
      document: LibraryDocumentRecord;
    }
  | {
      ok: true;
      intent: "update-cover-types";
      document: LibraryDocumentRecord;
    }
  | { ok: false; error: string; clientId?: string };

export const MAX_SIZE = 50 * 1024 * 1024;
export const MAX_FILES = 20;

export function toMetadata(docs: LibraryDocumentRecord[]): FileMetadata[] {
  return docs.map((doc) => ({
    id: String(doc.libraryDocumentId),
    name: doc.filename,
    size: doc.sizeBytes,
    type: doc.contentType || "application/pdf",
    url: libraryDocumentPublicPath(doc.libraryDocumentId),
  }));
}

export function toUploadItems(docs: LibraryDocumentRecord[]): UploadItem[] {
  return toMetadata(docs).map((file) => ({
    id: file.id,
    file: {
      name: file.name,
      size: file.size,
      type: file.type,
    } as File,
    preview: file.url,
    status: "completed" as const,
    libraryDocumentId: Number(file.id),
  }));
}

export function completedItem(doc: LibraryDocumentRecord): UploadItem {
  return {
    id: String(doc.libraryDocumentId),
    file: {
      name: doc.filename,
      size: doc.sizeBytes,
      type: doc.contentType || "application/pdf",
    } as File,
    preview: libraryDocumentPublicPath(doc.libraryDocumentId),
    status: "completed",
    libraryDocumentId: doc.libraryDocumentId,
  };
}

export function coverTypeLabel(
  coverTypeIds: number[],
  coverTypes: CoverTypeOption[],
): string {
  if (coverTypeIds.length === 0) return "None";
  return coverTypes
    .filter((cover) => coverTypeIds.includes(cover.coverTypeId))
    .map((cover) => cover.name)
    .join(", ");
}
