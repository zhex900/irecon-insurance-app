import { z } from "zod";

import { requireAuth } from "~/lib/auth/session/server.server";
import { getExcelService } from "~/lib/cloudflare.server";
import { invalidInputResponse } from "~/lib/http/route-input";
import { trackUsage } from "~/lib/observability/metrics.server";
import {
  auditReportExport,
  exportCarPolicyDetailExcel,
  exportCarPolicySummaryExcel,
  resolveOptionalIsoDateParam,
} from "~/lib/reports/report-export.server";
import {
  filtersForCarSearchStatus,
  getCarPolicyReportSummary,
  listReportPoliciesPage,
} from "~/lib/services/reports/list.service";
import {
  CAR_SEARCH_STATUSES,
  defaultCarPolicyPeriod,
} from "~/lib/services/reports/service";

import type { Route } from "./+types/reports.car-policies.xlsx";

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  view: z.enum(["summary", "detail"]).catch("summary"),
  status: z.enum(CAR_SEARCH_STATUSES).optional(),
});

export async function loader({ request, context }: Route.LoaderArgs) {
  const actor = await requireAuth(request);
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success)
    return invalidInputResponse("Invalid export parameters.");

  const defaults = defaultCarPolicyPeriod();
  const dateFrom =
    resolveOptionalIsoDateParam(parsed.data.from ?? null) || defaults.dateFrom;
  const dateTo =
    resolveOptionalIsoDateParam(parsed.data.to ?? null) || defaults.dateTo;

  if (parsed.data.view === "detail") {
    const status = parsed.data.status;
    if (!status) {
      return invalidInputResponse("A valid report status is required.");
    }
    const filters = filtersForCarSearchStatus(status);
    const page = await listReportPoliciesPage({
      dateFrom,
      dateTo,
      statusIds: filters.statusIds,
      policyCategoryIds: filters.policyCategoryIds,
      limit: 5000,
      offset: 0,
    });
    const slug = status.replace(/\s+/g, "-").toLowerCase();
    const filename = `car-policy-report-${slug}-${dateFrom}-${dateTo}.xlsx`;

    await auditReportExport({
      actor,
      entityId: "car-policies-detail",
      summary: `Exported CAR policy detail Excel for ${status} (${page.rows.length} rows)`,
      filename,
      metadata: {
        dateFrom,
        dateTo,
        statusLabel: status,
        rowCount: page.rows.length,
      },
      request,
    });

    trackUsage("report.export", {
      report: "car_policies",
      view: "detail",
    });

    const excelService = getExcelService(context);
    if (!excelService) {
      throw new Error("Excel service not available");
    }
    return exportCarPolicyDetailExcel(
      page.rows,
      status,
      filename,
      excelService,
    );
  }

  const summary = await getCarPolicyReportSummary(dateFrom, dateTo);
  const filename = `car-policy-report-${dateFrom}-${dateTo}.xlsx`;

  await auditReportExport({
    actor,
    entityId: "car-policies-summary",
    summary: `Exported CAR policy summary Excel (${summary.length} rows)`,
    filename,
    metadata: {
      dateFrom,
      dateTo,
      rowCount: summary.length,
    },
    request,
  });

  trackUsage("report.export", {
    report: "car_policies",
    view: "summary",
  });

  const excelService = getExcelService(context);
  if (!excelService) {
    throw new Error("Excel service not available");
  }
  return exportCarPolicySummaryExcel(summary, filename, excelService);
}
