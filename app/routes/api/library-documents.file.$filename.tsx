import { requireAuth } from "~/lib/auth/session/server.server";
import { getLibraryDocumentsBucket } from "~/lib/cloudflare.server";
import { getLibraryDocumentByFilename } from "~/lib/services/documents/library-documents";
import {
  applyPrivatePdfResponseHeaders,
  getLibraryDocumentObject,
} from "~/lib/storage/library-documents.server";

import type { Route } from "./+types/library-documents.file.$filename";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  await requireAuth(request);
  const filename = decodeURIComponent(params.filename ?? "").trim();
  if (!filename) {
    throw new Response("Not found", { status: 404 });
  }

  const doc = await getLibraryDocumentByFilename(filename);
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
  applyPrivatePdfResponseHeaders(headers, doc.filename);
  return new Response(object.body, { headers });
}
