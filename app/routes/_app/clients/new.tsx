import { redirect } from "react-router";
import { requireAuth } from "~/lib/auth/session.server";
import { writeAuditLog } from "~/lib/services/audit/service";
import { createClientDraft } from "~/lib/services/clients/service";
import type { Route } from "./+types/new";

export function meta() {
  return [{ title: "New Client | BrokerSure" }];
}

/** Create a draft client then open the edit form (same pattern as new policy). */
export async function loader({ request }: Route.LoaderArgs) {
  const actor = await requireAuth(request);
  const client = await createClientDraft();
  await writeAuditLog({
    actor,
    action: "client.create",
    entityType: "client",
    entityId: client.clientId,
    summary: `Created client #${client.clientId}`,
    request,
  });
  return redirect(`/clients/${client.clientId}/edit?new=1`);
}

export default function NewClientRoute() {
  return null;
}
