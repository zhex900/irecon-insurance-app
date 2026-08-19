import { z } from "zod";

import { requireAuth } from "~/lib/auth/session/server.server";
import { getLibraryDocumentsBucket } from "~/lib/cloudflare.server";
import { parseUuid } from "~/lib/http/route-input";
import { getPolicy } from "~/lib/services/policy/data.service";
import {
  applyPrivatePdfResponseHeaders,
  getLibraryDocumentObject,
} from "~/lib/storage/library-documents.server";

import type { Route } from "./+types/policies.$policyId.documents.r2";

const querySchema = z.object({
  key: z.string().trim().min(1).max(512),
});

/** Stream a migrated policy PDF from R2 by object key. */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  await requireAuth(request);
  const policyId = parseUuid(params.policyId);
  if (!policyId) {
    throw new Response("Invalid policy id", { status: 400 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    throw new Response("Missing key", { status: 400 });
  }

  const policy = await getPolicy(policyId);
  if (!policy) {
    throw new Response("Not found", { status: 404 });
  }

  const allowed = (policy.documents ?? []).some(
    (doc) => doc.r2Key === parsed.data.key,
  );
  if (!allowed) {
    throw new Response("Not found", { status: 404 });
  }

  const bucket = getLibraryDocumentsBucket(context);
  if (!bucket) {
    throw new Response("Document storage is not configured", { status: 503 });
  }

  const object = await getLibraryDocumentObject(bucket, parsed.data.key);
  if (!object?.body) {
    throw new Response("File not found in storage", { status: 404 });
  }

  const filename =
    parsed.data.key.split("/").pop()?.replace(/^\d+-/, "") ?? "document.pdf";
  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  applyPrivatePdfResponseHeaders(headers, filename);
  return new Response(object.body, { headers });
}
