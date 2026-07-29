import { requireAuth } from "~/lib/auth/session.server";
import { listPdfTemplateSlots } from "~/lib/pdf/templates";
import { getDocumentTemplateOverride } from "~/lib/services/documents/document-templates";
import type { Route } from "./+types/document-templates.$slotKey";

/** Published pdfme override for a slot (204 = use seed asset). */
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const slotKey = String(params.slotKey ?? "");
  if (!listPdfTemplateSlots().some((slot) => slot.key === slotKey)) {
    return Response.json({ error: "Unknown template slot" }, { status: 404 });
  }

  const override = await getDocumentTemplateOverride(slotKey);
  if (!override) {
    return new Response(null, { status: 204 });
  }

  return Response.json({
    template: override.template,
    flowPushDown: override.flowPushDown,
    mergeFields: override.mergeFields,
    versionNumber: override.versionNumber,
  });
}
