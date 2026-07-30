import {
  diffDocumentTemplates,
  type TemplateChange,
} from "~/lib/pdf/template-changelog";
import {
  getDocumentTemplateVersion,
  listDocumentTemplateVersions,
} from "~/lib/services/documents/document-templates";
import { resolveNoteAuthors } from "~/lib/services/users/service";

/** Loader-safe template payload (JSON-serializable). */
export type DocumentTemplateHistoryTemplate = {
  basePdf: string | Record<string, unknown>;
  schemas: Record<string, unknown>[][];
  pdfmeVersion?: string;
};

export type DocumentTemplateHistoryEntry = {
  versionNumber: number;
  isPublished: boolean;
  createdWhen: string | null;
  createdBy: string;
  authorName: string;
  title: string;
  coverTypeId: number | null;
  changes: TemplateChange[];
  /** Omitted from list responses — fetch via getDocumentTemplateHistoryTemplate. */
  template?: DocumentTemplateHistoryTemplate;
};

/** Versions newest-first with author full name + changelog vs previous version. */
export async function getDocumentTemplateHistory(
  documentTemplateKey: string,
): Promise<DocumentTemplateHistoryEntry[]> {
  const versions = await listDocumentTemplateVersions(documentTemplateKey);
  const authors = await resolveNoteAuthors(versions.map((v) => v.createdBy));
  const liveVersionNumber =
    versions.find((v) => v.isPublished)?.versionNumber ?? null;

  return versions.map((version, index) => {
    const previous = versions[index + 1] ?? null;
    const emailKey = version.createdBy.trim().toLowerCase();
    const author = authors[emailKey];
    const authorName =
      author?.fullName?.trim() || version.createdBy.trim() || "Unknown";

    const changes = diffDocumentTemplates(
      previous?.template ?? null,
      version.template,
      {
        previousTitle: previous?.title,
        nextTitle: version.title,
        previousCoverTypeId: previous?.coverTypeId,
        nextCoverTypeId: version.coverTypeId,
        published: version.versionNumber === liveVersionNumber,
      },
    );

    return {
      versionNumber: version.versionNumber,
      isPublished: version.isPublished,
      createdWhen: version.createdWhen,
      createdBy: version.createdBy,
      authorName,
      title: version.title,
      coverTypeId: version.coverTypeId,
      changes,
      // Intentionally omit `template` from the editor loader payload — full
      // schemas for every version blow Worker memory on SSR. Fetch on demand.
    };
  });
}

/** Full template for one history version (preview / open in editor). */
export async function getDocumentTemplateHistoryTemplate(
  documentTemplateKey: string,
  versionNumber: number,
): Promise<DocumentTemplateHistoryTemplate | null> {
  const version = await getDocumentTemplateVersion(
    documentTemplateKey,
    versionNumber,
  );
  if (!version) return null;
  return {
    basePdf: version.template.basePdf as string | Record<string, unknown>,
    schemas: version.template.schemas as Record<string, unknown>[][],
    pdfmeVersion: version.template.pdfmeVersion,
  };
}
