import { requireAuth } from "~/lib/auth/session.server";
import { listClientsPage } from "~/lib/services/clients/list.service";
import {
  filtersForCarSearchStatus,
  listReportPoliciesPage,
} from "~/lib/services/reports/list.service";
import { searchGlobal } from "~/lib/services/search/global-search.service";
import type { CarSearchStatus } from "~/lib/services/reports/service";
import type { Route } from "./+types/search";

/**
 * GET /api/search?q=… — global clients + policies (capped).
 * GET /api/search?type=clients&q=…&limit=… — client picker / typeahead.
 * GET /api/search?type=report-detail&from=&to=&status= — report drill-down.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const type = url.searchParams.get("type") ?? "global";
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? "8") || 8, 1),
    5000,
  );

  if (type === "clients") {
    const page = await listClientsPage({
      search: q,
      limit: Math.min(limit, 50),
      offset: 0,
    });
    return Response.json({
      clients: page.rows.map((c) => ({
        clientId: c.clientId,
        name: c.name,
        tradingName: c.tradingName,
      })),
    });
  }

  if (type === "report-detail") {
    const dateFrom = url.searchParams.get("from") ?? "";
    const dateTo = url.searchParams.get("to") ?? "";
    const status = (url.searchParams.get("status") ?? "") as CarSearchStatus;
    const filters = filtersForCarSearchStatus(status);
    const page = await listReportPoliciesPage({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
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
