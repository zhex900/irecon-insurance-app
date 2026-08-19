import { redirect } from "react-router";

import { requireAuth } from "~/lib/auth/session/server.server";
import { clientNotFoundResponse } from "~/lib/http/resource-not-found";
import { searchParamsObject, uuidParamSchema } from "~/lib/http/route-input";
import { writeAuditLog } from "~/lib/services/audit/service";
import { getClient } from "~/lib/services/clients/service";
import { createPolicyDraft } from "~/lib/services/policy/data.service";

import type { Route } from "./+types/new";

/** Direct GET (typed URL, refresh) has nothing to create yet — send to the list. */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return redirect("/clients");
}

export async function action({ request }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  const parsedClientId = uuidParamSchema.safeParse(
    searchParamsObject(request).clientId,
  );
  if (!parsedClientId.success) throw redirect("/clients");
  const clientId = parsedClientId.data;
  const client = await getClient(clientId);
  if (!client) throw clientNotFoundResponse();

  const policy = await createPolicyDraft(clientId, {}, actor.email);
  await writeAuditLog({
    actor,
    action: "policy.create",
    entityType: "policy",
    entityId: policy.policyId,
    summary: `Created policy ${policy.policyNumber} for ${client.name}`,
    metadata: { clientId, policyNumber: policy.policyNumber },
    request,
  });
  return redirect(`/policies/${policy.policyId}?new=1`);
}

export default function NewPolicyRoute() {
  return null;
}
