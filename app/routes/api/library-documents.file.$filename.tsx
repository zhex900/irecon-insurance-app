import { requireAuth } from "~/lib/auth/session.server";
import { getLibraryDocumentsBucket } from "~/lib/cloudflare.server";
import { getLibraryDocumentByFilename } from "~/lib/services/documents/library-documents";
import { getLibraryDocumentObject } from "~/lib/storage/library-documents.server";
import { LIBRARY_DOCUMENT_PATHS } from "~/lib/pdf/templates";
import type { Route } from "./+types/library-documents.file.$filename";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  await requireAuth(request);
  const filename = decodeURIComponent(params.filename ?? "").trim();
  if (!filename) {
    throw new Response("Not found", { status: 404 });
  }

  const doc = await getLibraryDocumentByFilename(filename);
  if (doc) {
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
  }

  const publicPath = LIBRARY_DOCUMENT_PATHS[filename];
  if (publicPath) {
    const url = new URL(publicPath, request.url);
    const res = await fetch(url);
    if (res.ok) {
      const headers = new Headers();
      headers.set("Content-Type", "application/pdf");
      headers.set("Cache-Control", "private, max-age=3600");
      headers.set(
        "Content-Disposition",
        `inline; filename="${filename.replace(/"/g, "")}"`,
      );
      return new Response(res.body, { headers });
    }
  }

  throw new Response("Not found", { status: 404 });
}
