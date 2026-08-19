import { requireAuth } from "~/lib/auth/session/server.server";
import {
  getDocumentTemplateOverride,
  getDocumentTemplateVersion,
} from "~/lib/services/documents/document-templates";

import type { Route } from "./+types/document-templates.$templateKey";

/**
 * Published pdfme template for a key (404 when nothing published).
 * Pass `?version=N` to load a specific history version (for editor preview/open).
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const templateKey = String(params.templateKey ?? "");
  if (!templateKey) {
    return Response.json({ error: "Unknown template" }, { status: 404 });
  }

  const versionRaw = new URL(request.url).searchParams.get("version");
  if (versionRaw != null && versionRaw !== "") {
    const versionNumber = Number(versionRaw);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return Response.json({ error: "Invalid version" }, { status: 400 });
    }
    const version = await getDocumentTemplateVersion(
      templateKey,
      versionNumber,
    );
    if (!version) {
      return Response.json({ error: "Version not found" }, { status: 404 });
    }
    return Response.json({
      template: version.template,
      flowPushDown: version.flowPushDown,
      mergeFields: version.mergeFields,
      versionNumber: version.versionNumber,
      coverTypeId: version.coverTypeId,
      title: version.title,
      label: version.label,
    });
  }

  const published = await getDocumentTemplateOverride(templateKey);
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
    label: published.label,
  });
}
