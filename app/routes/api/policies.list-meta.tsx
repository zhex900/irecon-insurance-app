import { requireAuth } from "~/lib/auth/session/server.server";
import { parsePagination } from "~/lib/pagination";
import { parsePolicyListFiltersFromUrl } from "~/lib/search/policy-list-filters";
import {
  getPolicyListMeta,
  type PolicyListMetaResponse,
} from "~/lib/services/policies/list.service";

import type { Route } from "./+types/policies.list-meta";

/**
 * GET /api/policies/list-meta — filter badge counts for the policies list.
 * Query params mirror `/policies` (pagination ignored).
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const filters = parsePolicyListFiltersFromUrl(url);
  // Pagination params are accepted but ignored — meta is filter-scoped, not page-scoped.
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

  const allCount = Object.values(meta.statusCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  return Response.json({ ...meta, allCount } satisfies PolicyListMetaResponse);
}
