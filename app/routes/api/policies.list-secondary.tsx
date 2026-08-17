import { requireAuth } from "~/lib/auth/session/server.server";
import { parsePagination } from "~/lib/pagination";
import { parsePolicyListFiltersFromUrl } from "~/lib/search/policy-list-filters";
import {
  getPolicyListMeta,
  type PolicyListMetaResponse,
  type PolicyListSecondaryResponse,
} from "~/lib/services/policies/list.service";
import { getListReferenceAsync } from "~/lib/services/reference.service";

import type { Route } from "./+types/policies.list-secondary";

/**
 * GET /api/policies/list-secondary — filter badge counts + live AM/AR for the policies list.
 * One Worker request replaces separate list-meta + reference/list fetchers.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const filters = parsePolicyListFiltersFromUrl(url);
  parsePagination(url, { defaultSize: 25 });

  const meta = await getPolicyListMeta({
    search: filters.q,
    policyStatusIds: filters.statusIds,
    coverTypeIds: filters.coverTypeIds,
    policyCategoryIds: filters.policyCategoryIds,
    clientIds: filters.clientIds,
    inceptionFrom: filters.inception.from,
    inceptionTo: filters.inception.to,
    expiryFrom: filters.expiry.from,
    expiryTo: filters.expiry.to,
  });
  const reference = await getListReferenceAsync();

  const allCount = Object.values(meta.statusCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  return Response.json({
    meta: { ...meta, allCount } satisfies PolicyListMetaResponse,
    reference,
  } satisfies PolicyListSecondaryResponse);
}
