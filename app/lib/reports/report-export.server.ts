import type { AppUser } from "~/lib/db/types";
import { optionalIsoDateSchema } from "~/lib/http/route-input";
import { writeAuditLog } from "~/lib/services/audit/service";
import type {
  CarPolicySummaryRow,
  CarSearchStatus,
  ReportPolicyRow,
  RenewalReportRow,
} from "~/lib/services/reports/service";
import { formatDate } from "~/lib/utils";
import type { ReportExcelColumn } from "~/lib/reports/report-excel.server";
import {
  buildReportExcelBuffer,
  reportExcelResponse,
} from "~/lib/reports/report-excel.server";

export function resolveOptionalIsoDateParam(raw: string | null): string {
  if (raw == null || raw === "") return "";
  return optionalIsoDateSchema.parse(raw) ?? "";
}

export async function auditReportExport(input: {
  actor: AppUser;
  entityId: string;
  summary: string;
  filename: string;
  metadata: Record<string, unknown>;
  request: Request;
}) {
  await writeAuditLog({
    actor: input.actor,
    action: "report.export",
    entityType: "report",
    entityId: input.entityId,
    summary: input.summary,
    metadata: {
      filename: input.filename,
      ...input.metadata,
    },
    request: input.request,
  });
}

export const CAR_POLICY_SUMMARY_COLUMNS: ReportExcelColumn[] = [
  { header: "Status", key: "status", width: 22 },
  {
    header: "Number of Policies",
    key: "policyCount",
    width: 20,
    type: "integer",
  },
  {
    header: "Total Base Premium Combined",
    key: "totalBasePremium",
    width: 28,
    type: "currency",
  },
];

export async function exportCarPolicySummaryExcel(
  summary: CarPolicySummaryRow[],
  filename: string,
  excelService?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  },
) {
  const buffer = await buildReportExcelBuffer({
    sheetName: "Summary",
    columns: CAR_POLICY_SUMMARY_COLUMNS,
    rows: summary.map((row) => ({
      status: row.status,
      policyCount: row.policyCount,
      totalBasePremium: row.totalBasePremium,
    })),
    excelService,
  });
  return reportExcelResponse(buffer, filename);
}

export const CAR_POLICY_DETAIL_COLUMNS: ReportExcelColumn[] = [
  { header: "Client Name", key: "clientName", width: 32 },
  { header: "AR Name", key: "arName", width: 24 },
  { header: "Date Quoted", key: "dateQuoted", width: 14 },
  { header: "Base Premium", key: "basePremium", width: 16, type: "currency" },
];

export async function exportCarPolicyDetailExcel(
  rows: ReportPolicyRow[],
  statusLabel: CarSearchStatus,
  filename: string,
  excelService?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  },
) {
  const buffer = await buildReportExcelBuffer({
    sheetName: statusLabel.slice(0, 31),
    columns: CAR_POLICY_DETAIL_COLUMNS,
    rows: rows.map((row) => ({
      clientName: row.clientName,
      arName: row.arName.trim() || "",
      dateQuoted: formatDate(row.createdWhen),
      basePremium: row.basePremium,
    })),
    excelService,
  });
  return reportExcelResponse(buffer, filename);
}

export const CAR_RENEWAL_REPORT_COLUMNS: ReportExcelColumn[] = [
  { header: "Status", key: "status", width: 14 },
  { header: "Category", key: "category", width: 14 },
  { header: "Client", key: "client", width: 32 },
  { header: "Expiry", key: "expiry", width: 14 },
  { header: "AR", key: "ar", width: 24 },
  { header: "AR Email", key: "arEmail", width: 28 },
  { header: "Due Next Days", key: "dueNextDays", width: 16, type: "integer" },
];

export async function exportCarRenewalReportExcel(
  rows: RenewalReportRow[],
  filename: string,
  excelService?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  },
) {
  const buffer = await buildReportExcelBuffer({
    sheetName: "Renewals",
    columns: CAR_RENEWAL_REPORT_COLUMNS,
    rows: rows.map((row) => ({
      status: row.statusName,
      category: row.policyCategoryName,
      client: row.clientName,
      expiry: formatDate(row.dateEnd),
      ar: row.arName.trim() || "",
      arEmail: row.arEmail.trim() || "",
      dueNextDays: row.dueNextDays,
    })),
    excelService,
  });
  return reportExcelResponse(buffer, filename);
}
