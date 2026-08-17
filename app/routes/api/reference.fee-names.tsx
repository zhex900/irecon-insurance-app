import { requireAuth } from "~/lib/auth/session/server.server";
import { getFeeNamesAsync } from "~/lib/services/reference.service";

import type { Route } from "./+types/reference.fee-names";

/** GET /api/reference/fee-names?asOf=YYYY-MM-DD — broker fee lines for premium breakdown. */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const asOf = new URL(request.url).searchParams.get("asOf") ?? undefined;
  const feeNames = await getFeeNamesAsync(asOf ?? undefined);
  return Response.json(feeNames);
}
