import { requireAuth } from "~/lib/auth/session/server.server";
import { parsePolicyListFiltersFromUrl } from "~/lib/search/policy-list-filters";
import {
  getPolicyListMeta,
  type PolicyListMetaResponse,
  type PolicyListStatsResponse,
} from "~/lib/services/policies/list.service";
import { getListReferenceAsync } from "~/lib/services/reference.service";

import type { Route } from "./+types/policies.list-stats";

/**
 * GET /api/policies/list-stats — filter badge counts + live AM/AR for the policies list.
 * One Worker request replaces separate list-meta + reference/list fetchers.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const filters = parsePolicyListFiltersFromUrl(url);

  const [meta, reference] = await Promise.all([
    getPolicyListMeta({
      search: filters.q,
      policyStatusIds: filters.statusIds,
      coverTypeIds: filters.coverTypeIds,
      policyCategoryIds: filters.policyCategoryIds,
      clientIds: filters.clientIds,
      inceptionFrom: filters.inception.from,
      inceptionTo: filters.inception.to,
      expiryFrom: filters.expiry.from,
      expiryTo: filters.expiry.to,
    }),
    getListReferenceAsync(),
  ]);

  const allCount = Object.values(meta.statusCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  return Response.json({
    meta: { ...meta, allCount } satisfies PolicyListMetaResponse,
    reference,
  } satisfies PolicyListStatsResponse);
}
