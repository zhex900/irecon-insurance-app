import { FileStackIcon } from "lucide-react";
import { PageHeader } from "~/components/layout/app-layout";
import { MainManager } from "~/components/documents/library";
import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import { requireFeatureOrSuperAdminPage } from "~/lib/auth/authorize.server";
import { requireAuth } from "~/lib/auth/session/server.server";
import { getLibraryDocumentsBucket } from "~/lib/cloudflare.server";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { parseFormIntent, parsePositiveInteger } from "~/lib/http/route-input";
import { writeAuditLog } from "~/lib/services/audit/service";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import {
  deleteLibraryDocument,
  listLibraryDocuments,
  updateLibraryDocumentCoverTypes,
  updateLibraryDocumentLabel,
  uploadLibraryDocument,
} from "~/lib/services/documents/library-documents";
import { referenceData } from "~/lib/reference-data";
import type { Route } from "./+types/library-documents";
import { pageTitle } from "~/lib/brand";

export function meta() {
  return [{ title: pageTitle("Library Documents") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const enabled = await isFeatureEnabled("library_documents");
  requireFeatureOrSuperAdminPage(enabled, viewer);
  return {
    documents: await listLibraryDocuments(),
    coverTypes: referenceData.coverTypes,
    canEdit: isAdminRole(viewer),
    libraryDocumentsEnabled: enabled,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const viewer = await requireAuth(request);
  if (!isAdminRole(viewer)) {
    return {
      ok: false as const,
      error: "Only admins can manage library documents.",
    };
  }

  const enabled = await isFeatureEnabled("library_documents");
  if (!enabled && !isSuperAdmin(viewer)) {
    return { ok: false as const, error: "Library documents is disabled." };
  }

  const bucket = getLibraryDocumentsBucket(context);
  if (!bucket) {
    return {
      ok: false as const,
      error:
        "Library document storage (R2) is not configured. Add the LIBRARY_DOCUMENTS bucket binding.",
    };
  }

  const formData = await request.formData();
  const intent = parseFormIntent(formData, [
    "upload",
    "delete",
    "update-label",
    "update-cover-types",
  ]);

  if (intent === "upload") {
    const clientId = String(formData.get("clientId") ?? "");
    const filenameHint = String(formData.get("filename") ?? "").trim();
    const raw = formData.get("file");

    let uploadFile: File | null = null;
    if (raw instanceof File && raw.size > 0) {
      uploadFile = raw;
    } else if (raw instanceof Blob && raw.size > 0) {
      const name =
        filenameHint ||
        (typeof (raw as { name?: unknown }).name === "string"
          ? String((raw as { name: string }).name)
          : "upload.pdf");
      uploadFile = new File([raw], name, {
        type: raw.type || "application/pdf",
      });
    }

    if (!uploadFile) {
      return {
        ok: false as const,
        error: "Choose a PDF file to upload.",
        clientId: clientId || undefined,
      };
    }

    try {
      const document = await uploadLibraryDocument(
        bucket,
        uploadFile,
        viewer.email,
      );
      await writeAuditLog({
        actor: viewer,
        action: "settings.library_document_upload",
        entityType: "library_document",
        entityId: String(document.libraryDocumentId),
        summary: `Uploaded library document ${document.filename}`,
        metadata: {
          filename: document.filename,
          sizeBytes: document.sizeBytes,
        },
        request,
      });
      return {
        ok: true as const,
        intent: "upload" as const,
        clientId,
        document,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Upload failed.",
          operation: "library_document_upload",
        }),
        clientId: clientId || undefined,
      };
    }
  }

  if (intent === "delete") {
    const id = parsePositiveInteger(formData.get("id"));
    if (!id) {
      return { ok: false as const, error: "Invalid document." };
    }
    try {
      const deleted = await deleteLibraryDocument(bucket, id);
      if (!deleted) {
        return { ok: false as const, error: "Document not found." };
      }
      await writeAuditLog({
        actor: viewer,
        action: "settings.library_document_delete",
        entityType: "library_document",
        entityId: String(id),
        summary: `Deleted library document ${deleted.filename}`,
        metadata: { filename: deleted.filename },
        request,
      });
      return { ok: true as const, intent: "delete" as const, id };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Delete failed.",
          operation: "library_document_delete",
        }),
      };
    }
  }

  if (intent === "update-label") {
    const id = parsePositiveInteger(formData.get("id"));
    const label = String(formData.get("label") ?? "");
    if (!id) {
      return { ok: false as const, error: "Invalid document." };
    }
    try {
      const document = await updateLibraryDocumentLabel(
        { id, label },
        viewer.email,
      );
      if (!document) {
        return { ok: false as const, error: "Document not found." };
      }
      await writeAuditLog({
        actor: viewer,
        action: "settings.library_document_label",
        entityType: "library_document",
        entityId: String(id),
        summary: `Updated library document label for ${document.filename}`,
        metadata: { filename: document.filename, label: document.displayName },
        request,
      });
      return {
        ok: true as const,
        intent: "update-label" as const,
        document,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Update failed.",
          operation: "library_document_cover_types_update",
        }),
      };
    }
  }

  if (intent === "update-cover-types") {
    const id = parsePositiveInteger(formData.get("id"));
    if (!id) {
      return { ok: false as const, error: "Invalid document." };
    }
    const coverTypeIds = formData
      .getAll("coverTypeId")
      .map(parsePositiveInteger)
      .filter((value): value is number => value !== undefined);
    try {
      const document = await updateLibraryDocumentCoverTypes(
        { id, coverTypeIds },
        viewer.email,
      );
      if (!document) {
        return { ok: false as const, error: "Document not found." };
      }
      await writeAuditLog({
        actor: viewer,
        action: "settings.library_document_cover_types",
        entityType: "library_document",
        entityId: String(id),
        summary: `Updated cover types for library document ${document.filename}`,
        metadata: {
          filename: document.filename,
          coverTypeIds: document.coverTypeIds,
        },
        request,
      });
      return {
        ok: true as const,
        intent: "update-cover-types" as const,
        document,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Update failed.",
          operation: "library_document_label_update",
        }),
      };
    }
  }

  return { ok: false as const, error: "Unknown action." };
}

export default function SettingsLibraryDocumentsRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <div>
      <PageHeader
        title="Library Documents"
        description={
          loaderData.libraryDocumentsEnabled
            ? "Static PDFs attached to CAR document packs (stored in R2)."
            : "Library Documents is disabled for other roles. Super-admins can still manage it."
        }
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Library Documents" },
        ]}
      />
      <div className="flex items-start gap-3 pb-4 text-sm text-muted-foreground">
        <FileStackIcon className="mt-0.5 size-4 shrink-0" />
        <p>Uploading replaces an existing file with the same name.</p>
      </div>
      <MainManager
        documents={loaderData.documents}
        coverTypes={loaderData.coverTypes}
        canEdit={loaderData.canEdit}
      />
    </div>
  );
}
