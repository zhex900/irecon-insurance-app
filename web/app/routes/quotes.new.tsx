import { redirect } from "react-router";
import { getClient, createQuoteDraft } from "~/lib/services/store";
import type { Route } from "./+types/quotes.new";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const clientId = Number(url.searchParams.get("clientId"));
  const client = await getClient(clientId);
  if (!client) throw new Response("Client not found", { status: 404 });

  const quote = await createQuoteDraft(clientId, {});
  return redirect(`/quotes/${quote.policyId}`);
}
