import { requireAuth } from "~/lib/auth/session.server";
import { listPublishedForCover } from "~/lib/services/documents/document-templates";
import type { Route } from "./+types/document-templates";

/** Published templates for a cover type (pack building). */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const coverTypeId = Number(url.searchParams.get("coverTypeId"));
  if (![1, 2, 3].includes(coverTypeId)) {
    return Response.json(
      { error: "coverTypeId must be 1, 2, or 3" },
      { status: 400 },
    );
  }

  const templates = await listPublishedForCover(coverTypeId);
  return Response.json({
    templates: templates.map((t) => ({
      key: t.key,
      title: t.title,
      label: t.label,
      coverTypeId: t.coverTypeId,
      versionNumber: t.versionNumber,
    })),
  });
}
