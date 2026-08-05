import { z } from "zod";
import { requireAuth } from "~/lib/auth/session.server";
import { searchParamsObject } from "~/lib/http/route-input";
import { listPublishedForCover } from "~/lib/services/documents/document-templates";
import type { Route } from "./+types/document-templates";

const querySchema = z.object({
  coverTypeId: z.coerce
    .number()
    .int()
    .refine((value) => [1, 2, 3].includes(value)),
});

/** Published templates for a cover type (review pack building; excludes adjustment). */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const parsed = querySchema.safeParse(searchParamsObject(request));
  if (!parsed.success) {
    return Response.json(
      { error: "coverTypeId must be 1, 2, or 3" },
      { status: 400 },
    );
  }
  const { coverTypeId } = parsed.data;

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
