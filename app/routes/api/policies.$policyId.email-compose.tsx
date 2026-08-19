import { requireAuth } from "~/lib/auth/session/server.server";
import {
  clientNotFoundResponse,
  policyNotFoundResponse,
} from "~/lib/http/resource-not-found";
import { parseUuid } from "~/lib/http/route-input";
import { getClient } from "~/lib/services/clients/service";
import { getPolicyEmailComposeContext } from "~/lib/services/email/policy-compose.server";
import { getPolicy } from "~/lib/services/policy/data.service";

import type { Route } from "./+types/policies.$policyId.email-compose";

/** GET /api/policies/:policyId/email-compose — templates, footer, directory, broker, AM (email dialog). */
export async function loader({ params, request }: Route.LoaderArgs) {
  await requireAuth(request);
  const policyId = parseUuid(params.policyId);
  if (!policyId) throw policyNotFoundResponse();
  const policy = await getPolicy(policyId);
  if (!policy) throw policyNotFoundResponse();
  const client = await getClient(policy.clientId);
  if (!client) throw clientNotFoundResponse();
  const compose = await getPolicyEmailComposeContext(client);
  return Response.json(compose);
}
