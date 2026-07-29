import { requireAuth } from "~/lib/auth/session.server";
import { getLibraryDocumentsBucket } from "~/lib/cloudflare.server";
import { getLibraryDocumentById } from "~/lib/services/documents/library-documents";
import { getLibraryDocumentObject } from "~/lib/storage/library-documents.server";
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
  if (!bucket) {
    throw new Response("Library document storage is not configured", {
      status: 503,
    });
  }

  const object = await getLibraryDocumentObject(bucket, doc.r2Key);
  if (!object?.body) {
    throw new Response("File not found in storage", { status: 404 });
  }

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
