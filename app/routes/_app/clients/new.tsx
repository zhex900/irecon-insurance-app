import { redirect } from "react-router";

import { requireAuth } from "~/lib/auth/session/server.server";
import { pageTitle } from "~/lib/brand";
import { writeAuditLog } from "~/lib/services/audit/service";
import { createClientDraft } from "~/lib/services/clients/service";

import type { Route } from "./+types/new";

export function meta() {
  return [{ title: pageTitle("New Client") }];
}

/** Direct GET (typed URL, refresh) has nothing to create yet — send to the list. */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return redirect("/clients");
}

/** Create a draft client then open the edit form (same pattern as new policy). */
export async function action({ request }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  const client = await createClientDraft(actor.email);
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
