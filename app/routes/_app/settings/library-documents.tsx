import { redirect } from "react-router";
import { FileStackIcon } from "lucide-react";
import { PageHeader } from "~/components/layout/app-layout";
import { LibraryDocumentsManager } from "~/components/settings/library-documents-manager";
import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import { requireAuth } from "~/lib/auth/session.server";
import { getLibraryDocumentsBucket } from "~/lib/cloudflare.server";
import { writeAuditLog } from "~/lib/services/audit/service";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import {
  deleteLibraryDocument,
  importSeedLibraryDocuments,
  listLibraryDocuments,
  uploadLibraryDocument,
} from "~/lib/services/documents/library-documents";
import type { Route } from "./+types/library-documents";
import { pageTitle } from "~/lib/brand";

export function meta() {
  return [{ title: pageTitle("Library documents") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const enabled = await isFeatureEnabled("library_documents");
  if (!enabled && !isSuperAdmin(viewer)) {
    throw redirect("/settings");
  }
  return {
    documents: await listLibraryDocuments(),
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
  const intent = String(formData.get("intent") ?? "");

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
        error: error instanceof Error ? error.message : "Upload failed.",
        clientId: clientId || undefined,
      };
    }
  }

  if (intent === "import_seed") {
    try {
      const documents = await importSeedLibraryDocuments(
        bucket,
        request.url,
        viewer.email,
      );
      await writeAuditLog({
        actor: viewer,
        action: "settings.library_document_upload",
        entityType: "library_document",
        entityId: "seed",
        summary: `Imported ${documents.length} seed library document(s)`,
        metadata: {
          filenames: documents.map((d) => d.filename),
        },
        request,
      });
      return {
        ok: true as const,
        intent: "import_seed" as const,
        count: documents.length,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Seed import failed.",
      };
    }
  }

  if (intent === "delete") {
    const id = Number(formData.get("id"));
    if (!Number.isFinite(id) || id <= 0) {
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
        error: error instanceof Error ? error.message : "Delete failed.",
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
        title="Library documents"
        description={
          loaderData.libraryDocumentsEnabled
            ? "Static PDFs attached to CAR document packs (stored in R2)."
            : "Library documents is disabled for other roles. Super-admins can still manage it."
        }
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Library documents" },
        ]}
      />
      <div className="flex items-start gap-3 pb-4 text-sm text-muted-foreground">
        <FileStackIcon className="mt-0.5 size-4 shrink-0" />
        <p>
          Uploading replaces an existing file with the same name. Deleting
          removes it from future packs only — already-issued policy documents
          are kept.
        </p>
      </div>
      <LibraryDocumentsManager
        documents={loaderData.documents}
        canEdit={loaderData.canEdit}
      />
    </div>
  );
}
