import { requireAuth } from "~/lib/auth/session/server.server";
import { getExcelService } from "~/lib/cloudflare.server";
import { queryTextSchema } from "~/lib/http/route-input";
import { trackUsage } from "~/lib/observability/metrics.server";
import {
  auditReportExport,
  exportCarRenewalReportExcel,
  resolveOptionalIsoDateParam,
} from "~/lib/reports/report-export.server";
import { parseIdListParam } from "~/lib/search/id-list-param";
import { listReportPoliciesPage } from "~/lib/services/reports/list.service";
import { dueNextDays, todayIsoDate } from "~/lib/services/reports/service";
import { POLICY_STATUS } from "~/lib/zod/policy-car";

import type { Route } from "./+types/reports.car-renewals.xlsx";

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = await requireAuth(request);
  const url = new URL(request.url);
  const referenceDate =
    resolveOptionalIsoDateParam(url.searchParams.get("ref")) || todayIsoDate();
  const search = queryTextSchema.parse(url.searchParams.get("q") ?? "");
  const parsedStatusIds = parseIdListParam(url.searchParams.get("status"));
  const statusIds = parsedStatusIds.length
    ? parsedStatusIds
    : [POLICY_STATUS.Taken, POLICY_STATUS.Pending, POLICY_STATUS.NotTaken];
  const parsedCategoryIds = parseIdListParam(url.searchParams.get("type"));
  const policyCategoryIds = parsedCategoryIds.length
    ? parsedCategoryIds
    : [1, 2];

  const page = await listReportPoliciesPage({
    search: search || undefined,
    statusIds,
    policyCategoryIds,
    orderBy: "dateEnd",
    limit: 5000,
    offset: 0,
  });

  const rows = page.rows.map((row) => ({
    ...row,
    dueNextDays: dueNextDays(referenceDate, row.dateEnd),
  }));

  const filename = `car-renewal-report-${referenceDate}.xlsx`;

  await auditReportExport({
    actor,
    entityId: "car-renewals",
    summary: `Exported CAR renewal Excel (${rows.length} rows)`,
    filename,
    metadata: {
      referenceDate,
      rowCount: rows.length,
      search: search || undefined,
      statusIds,
      policyCategoryIds,
    },
    request,
  });

  trackUsage("report.export", { report: "car_renewals", view: "list" });

  const excelService = getExcelService(context);
  if (!excelService) {
    throw new Error("Excel service not available");
  }
  return exportCarRenewalReportExcel(rows, filename, excelService);
}
