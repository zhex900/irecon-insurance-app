import { redirect } from "react-router";
import { requireAuth } from "~/lib/auth/session.server";
import {
  positiveIntegerSchema,
  searchParamsObject,
} from "~/lib/http/route-input";
import { writeAuditLog } from "~/lib/services/audit/service";
import { getClient } from "~/lib/services/clients/service";
import { createPolicyDraft } from "~/lib/services/policy/data.service";
import type { Route } from "./+types/new";

export async function loader({ request }: Route.LoaderArgs) {
  const actor = await requireAuth(request);
  const parsedClientId = positiveIntegerSchema.safeParse(
    searchParamsObject(request).clientId,
  );
  if (!parsedClientId.success) throw redirect("/clients");
  const clientId = parsedClientId.data;
  const client = await getClient(clientId);
  if (!client) throw new Response("Client not found", { status: 404 });

  const policy = await createPolicyDraft(clientId, {}, actor.email);
  await writeAuditLog({
    actor,
    action: "policy.create",
    entityType: "policy",
    entityId: policy.policyId,
    summary: `Created policy ${policy.policyNumber} for client #${clientId}`,
    metadata: { clientId, policyNumber: policy.policyNumber },
    request,
  });
  return redirect(`/policies/${policy.policyId}?new=1`);
}
