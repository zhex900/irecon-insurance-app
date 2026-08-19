import { requireAuth } from "~/lib/auth/session/server.server";
import { policyNotFoundResponse } from "~/lib/http/resource-not-found";
import { parseUuid } from "~/lib/http/route-input";
import { getPolicy } from "~/lib/services/policy/data.service";
import { resolveNoteAuthors } from "~/lib/services/users/service";

import type { Route } from "./+types/policies.$policyId.note-authors";

/** GET /api/policies/:policyId/note-authors — note author profiles for the policy notes rail. */
export async function loader({ params, request }: Route.LoaderArgs) {
  await requireAuth(request);
  const policyId = parseUuid(params.policyId);
  if (!policyId) throw policyNotFoundResponse();
  const policy = await getPolicy(policyId);
  if (!policy) throw policyNotFoundResponse();
  const noteAuthors = await resolveNoteAuthors(
    (policy.notes ?? []).map((note) => note.createdBy),
  );
  return Response.json(noteAuthors);
}
