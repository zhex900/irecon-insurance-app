import { redirect } from "react-router";
import { requireAuth } from "~/lib/auth/session.server";
import { searchParamsObject, uuidParamSchema } from "~/lib/http/route-input";
import { clientNotFoundResponse } from "~/lib/http/resource-not-found";
import { writeAuditLog } from "~/lib/services/audit/service";
import { getClient } from "~/lib/services/clients/service";
import { createPolicyDraft } from "~/lib/services/policy/data.service";
import type { Route } from "./+types/new";

export async function loader({ request }: Route.LoaderArgs) {
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
