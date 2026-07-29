import { requireAuth } from "~/lib/auth/session.server";
import { getDocumentTemplateOverride } from "~/lib/services/documents/document-templates";
import type { Route } from "./+types/document-templates.$slotKey";

/** Published pdfme template for a key (404 when nothing published). */
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const slotKey = String(params.slotKey ?? "");
  if (!slotKey) {
    return Response.json({ error: "Unknown template" }, { status: 404 });
  }

  const published = await getDocumentTemplateOverride(slotKey);
  if (!published) {
    return Response.json(
      { error: "No published template for this key" },
      { status: 404 },
    );
  }

  return Response.json({
    template: published.template,
    flowPushDown: published.flowPushDown,
    mergeFields: published.mergeFields,
    versionNumber: published.versionNumber,
    coverTypeId: published.coverTypeId,
    title: published.title,
  });
}
