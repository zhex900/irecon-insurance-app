import { requireAuth } from "~/lib/auth/session.server";
import {
  auditReportExport,
  exportClientReportExcel,
  resolveOptionalIsoDateParam,
} from "~/lib/reports/report-export.server";
import { listClientReportAll } from "~/lib/services/reports/list.service";
import type { Route } from "./+types/reports.clients.xlsx";

export async function loader({ request }: Route.LoaderArgs) {
  const actor = await requireAuth(request);
  const url = new URL(request.url);
  const dateFrom = resolveOptionalIsoDateParam(url.searchParams.get("from"));
  const dateTo = resolveOptionalIsoDateParam(url.searchParams.get("to"));

  const rows = await listClientReportAll({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const range =
    dateFrom || dateTo
      ? `${dateFrom || "all"}-${dateTo || "all"}`
      : "all-dates";
  const filename = `client-report-${range}.xlsx`;

  await auditReportExport({
    actor,
    entityId: "clients",
    summary: `Exported client report Excel (${rows.length} rows)`,
    filename,
    metadata: { dateFrom, dateTo, rowCount: rows.length },
    request,
  });

  return exportClientReportExcel(rows, filename, { dateFrom, dateTo });
}
