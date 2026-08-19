import { z } from "zod";

import { requireAuth } from "~/lib/auth/session/server.server";
import {
  invalidInputResponse,
  optionalStrictIsoDateSchema,
} from "~/lib/http/route-input";
import { getFeeNamesAsync } from "~/lib/services/reference.service";

import type { Route } from "./+types/reference.fee-names";

const feeNamesQuerySchema = z.object({
  asOf: optionalStrictIsoDateSchema,
});

/** GET /api/reference/fee-names?asOf=YYYY-MM-DD — broker fee lines for premium breakdown. */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const parsed = feeNamesQuerySchema.safeParse({
    asOf: new URL(request.url).searchParams.get("asOf"),
  });
  if (!parsed.success) {
    return invalidInputResponse("Invalid asOf date.");
  }
  const feeNames = await getFeeNamesAsync(parsed.data.asOf);
  return Response.json(feeNames);
}
