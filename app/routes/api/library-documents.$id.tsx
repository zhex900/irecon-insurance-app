import { requireAuth } from "~/lib/auth/session.server";
import { getLibraryDocumentsBucket } from "~/lib/cloudflare.server";
import { getLibraryDocumentById } from "~/lib/services/documents/library-documents";
import { getLibraryDocumentObject } from "~/lib/storage/library-documents.server";
import { LIBRARY_DOCUMENT_PATHS } from "~/lib/pdf/templates";
import type { Route } from "./+types/library-documents.$id";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  await requireAuth(request);
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Response("Not found", { status: 404 });
  }

  const doc = await getLibraryDocumentById(id);
  if (!doc) {
    throw new Response("Not found", { status: 404 });
  }

  const bucket = getLibraryDocumentsBucket(context);
  if (bucket) {
    const object = await getLibraryDocumentObject(bucket, doc.r2Key);
    if (object?.body) {
      const headers = new Headers();
      object.writeHttpMetadata?.(headers);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", doc.contentType || "application/pdf");
      }
      headers.set("Cache-Control", "private, max-age=3600");
      headers.set(
        "Content-Disposition",
        `inline; filename="${doc.filename.replace(/"/g, "")}"`,
      );
      return new Response(object.body, { headers });
    }
  }

  // Fallback for seed PDFs still served from public/ before R2 upload.
  const publicPath = LIBRARY_DOCUMENT_PATHS[doc.filename];
  if (publicPath) {
    const url = new URL(publicPath, request.url);
    const res = await fetch(url);
    if (res.ok) {
      const headers = new Headers();
      headers.set("Content-Type", "application/pdf");
      headers.set("Cache-Control", "private, max-age=3600");
      headers.set(
        "Content-Disposition",
        `inline; filename="${doc.filename.replace(/"/g, "")}"`,
      );
      return new Response(res.body, { headers });
    }
  }

  throw new Response("File not found in storage", { status: 404 });
}
