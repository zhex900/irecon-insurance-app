import { requireAuth } from "~/lib/auth/session/server.server";
import { getListReferenceAsync } from "~/lib/services/reference.service";

import type { Route } from "./+types/reference.list";

/**
 * GET /api/reference/list — live account managers + ARs for list page filters.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const reference = await getListReferenceAsync();
  return Response.json(reference);
}
