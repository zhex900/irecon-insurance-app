import { z } from "zod";
import { requireAuth } from "~/lib/auth/session.server";
import {
  invalidInputResponse,
  searchParamsObject,
} from "~/lib/http/route-input";
import { trackUsage } from "~/lib/observability/metrics.server";
import { parseUuidListParam } from "~/lib/search/id-list-param";
import { parsePolicyListFiltersFromUrl } from "~/lib/search/policy-list-filters";
import { countPoliciesForClientIds } from "~/lib/services/policies/list.service";
import {
  filtersForCarSearchStatus,
  listReportPoliciesPage,
} from "~/lib/services/reports/list.service";
import {
  searchClients,
  searchGlobal,
} from "~/lib/services/search/global-search.service";
import { CAR_SEARCH_STATUSES } from "~/lib/services/reports/service";
import type { Route } from "./+types/search";

const searchQuerySchema = z.object({
  q: z.string().trim().max(200).catch(""),
  type: z
    .enum(["global", "clients", "client-policy-counts", "report-detail"])
    .catch("global"),
  limit: z.coerce.number().int().min(1).max(5_000).catch(8),
  ids: z.string().max(10_000).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.enum(CAR_SEARCH_STATUSES).optional(),
});

/**
 * GET /api/search?q=… — global clients + policies (capped).
 * GET /api/search?type=clients&q=…&limit=… — client picker / typeahead.
 * GET /api/search?type=client-policy-counts&ids=1,2 — policy counts per client.
 * GET /api/search?type=report-detail&from=&to=&status= — report drill-down.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const parsed = searchQuerySchema.safeParse(searchParamsObject(request));
  if (!parsed.success) return invalidInputResponse("Invalid search query.");
  const { q, type, limit } = parsed.data;

  trackUsage("search.query", {
    type,
    has_query: Boolean(q),
  });

  if (type === "clients") {
    const results = await searchClients(q, Math.min(limit, 50));
    return Response.json(results);
  }

  if (type === "client-policy-counts") {
    const ids = parseUuidListParam(parsed.data.ids ?? null);
    const filters = parsePolicyListFiltersFromUrl(url);
    const counts = await countPoliciesForClientIds(
      {
        search: filters.q,
        policyStatusIds: filters.statusIds,
        coverTypeIds: filters.coverTypeIds,
        policyCategoryIds: filters.policyCategoryIds,
        inceptionFrom: filters.inception.from,
        inceptionTo: filters.inception.to,
        expiryFrom: filters.expiry.from,
        expiryTo: filters.expiry.to,
      },
      ids,
    );
    return Response.json({ counts });
  }

  if (type === "report-detail") {
    const dateFrom = parsed.data.from;
    const dateTo = parsed.data.to;
    const status = parsed.data.status;
    if (!status)
      return invalidInputResponse("A valid report status is required.");
    const filters = filtersForCarSearchStatus(status);
    const page = await listReportPoliciesPage({
      dateFrom,
      dateTo,
      statusIds: filters.statusIds,
      policyCategoryIds: filters.policyCategoryIds,
      limit: Math.min(limit, 5000),
      offset: 0,
    });
    return Response.json({ rows: page.rows, total: page.total });
  }

  const results = await searchGlobal(q, Math.min(limit, 8));
  return Response.json(results);
}
