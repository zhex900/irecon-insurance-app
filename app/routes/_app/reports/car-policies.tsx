import { DownloadIcon } from "lucide-react";
import { useMemo } from "react";
import { Form, Link, useSearchParams } from "react-router";
import { z } from "zod";

import { PageHeader } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { DateInput } from "~/components/ui/date-input";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { TablePagination } from "~/components/ui/table-pagination";
import { requireAuth } from "~/lib/auth/session/server.server";
import { pageTitle } from "~/lib/brand";
import { optionalIsoDateSchema } from "~/lib/http/route-input";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { recordAuditEventClient } from "~/lib/services/audit/client";
import {
  filtersForCarSearchStatus,
  getCarPolicyReportSummary,
  listReportPoliciesPage,
} from "~/lib/services/reports/list.service";
import {
  CAR_SEARCH_STATUSES,
  type CarSearchStatus,
  defaultCarPolicyPeriod,
} from "~/lib/services/reports/service";
import { formatCurrency, formatDate } from "~/lib/utils";

import type { Route } from "./+types/car-policies";

const DETAIL_PAGE_SIZE = 25;

export function meta() {
  return [{ title: pageTitle("CAR Policy Report") }];
}

const statusParamSchema = z.enum(CAR_SEARCH_STATUSES);

function parseStatusParam(raw: string | null): CarSearchStatus | null {
  const parsed = statusParamSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const defaults = defaultCarPolicyPeriod();
  const dateFrom =
    optionalIsoDateSchema.parse(url.searchParams.get("from") ?? undefined) ??
    defaults.dateFrom;
  const dateTo =
    optionalIsoDateSchema.parse(url.searchParams.get("to") ?? undefined) ??
    defaults.dateTo;
  const status = parseStatusParam(url.searchParams.get("status"));

  const summary = await getCarPolicyReportSummary(dateFrom, dateTo);

  if (!status) {
    return {
      summary,
      dateFrom,
      dateTo,
      detail: null,
    };
  }

  const pagination = parsePagination(url, { defaultSize: DETAIL_PAGE_SIZE });
  const filters = filtersForCarSearchStatus(status);
  const page = await listReportPoliciesPage({
    dateFrom,
    dateTo,
    statusIds: filters.statusIds,
    policyCategoryIds: filters.policyCategoryIds,
    limit: pagination.limit,
    offset: pagination.offset,
  });

  const detailMeta = summary.find((row) => row.status === status) ?? null;

  return {
    summary,
    dateFrom,
    dateTo,
    detail: {
      status,
      rows: page.rows,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      policyCount: detailMeta?.policyCount ?? page.total,
      totalBasePremium: detailMeta?.totalBasePremium ?? 0,
    },
  };
}

function statusDetailSearch(
  dateFrom: string,
  dateTo: string,
  status: CarSearchStatus,
) {
  const params = new URLSearchParams({ from: dateFrom, to: dateTo, status });
  return `?${params.toString()}`;
}

function auditCarPolicySummaryExport(
  dateFrom: string,
  dateTo: string,
  rowCount: number,
) {
  recordAuditEventClient({
    action: "report.export",
    entityType: "report",
    entityId: "car-policies-summary",
    summary: `Exported CAR policy summary Excel (${rowCount} rows)`,
    metadata: {
      filename: `car-policy-report-${dateFrom}-${dateTo}.xlsx`,
      dateFrom,
      dateTo,
      rowCount,
    },
  });
}

function auditCarPolicyDetailExport(
  dateFrom: string,
  dateTo: string,
  status: CarSearchStatus,
  rowCount: number,
) {
  const slug = status.replace(/\s+/g, "-").toLowerCase();
  recordAuditEventClient({
    action: "report.export",
    entityType: "report",
    entityId: "car-policies-detail",
    summary: `Exported CAR policy detail Excel for ${status} (${rowCount} rows)`,
    metadata: {
      filename: `car-policy-report-${slug}-${dateFrom}-${dateTo}.xlsx`,
      dateFrom,
      dateTo,
      statusLabel: status,
      rowCount,
    },
  });
}

export default function CarPolicyReportRoute({
  loaderData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const detail = loaderData.detail;

  const pageHref = (nextPage: number) => pageSearchHref(searchParams, nextPage);
  const pageSizeHref = (nextPageSize: number) =>
    pageSizeSearchHref(searchParams, nextPageSize, DETAIL_PAGE_SIZE);

  const summary = loaderData.summary;
  const totalPolicies = useMemo(
    () => summary.reduce((n, row) => n + row.policyCount, 0),
    [summary],
  );

  const summaryExportHref = `/api/reports/car-policies.xlsx?from=${encodeURIComponent(loaderData.dateFrom)}&to=${encodeURIComponent(loaderData.dateTo)}&view=summary`;
  const detailExportHref =
    detail != null
      ? `/api/reports/car-policies.xlsx?from=${encodeURIComponent(loaderData.dateFrom)}&to=${encodeURIComponent(loaderData.dateTo)}&view=detail&status=${encodeURIComponent(detail.status)}`
      : null;

  return (
    <div>
      <PageHeader
        title="CAR Policy Report"
        description="Summarise policies created in a period by status, then open a status for detail."
        breadcrumbs={[
          { label: "Reports", to: "/reports" },
          { label: "CAR Policy Report" },
        ]}
      />

      <Form
        key={`${loaderData.dateFrom}|${loaderData.dateTo}`}
        method="get"
        className="mb-4 flex flex-col gap-4 rounded-xl border bg-card p-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <FieldGroup className="gap-3 sm:flex-row">
            <Field className="sm:w-44">
              <FieldLabel htmlFor="dateFrom">Date from</FieldLabel>
              <DateInput
                id="dateFrom"
                name="from"
                defaultValue={loaderData.dateFrom}
                className="w-full"
              />
            </Field>
            <Field className="sm:w-44">
              <FieldLabel htmlFor="dateTo">Date to</FieldLabel>
              <DateInput
                id="dateTo"
                name="to"
                defaultValue={loaderData.dateTo}
                className="w-full"
              />
            </Field>
          </FieldGroup>
          <Button type="submit">Apply</Button>
        </div>
        <a
          href={summaryExportHref}
          className={buttonVariants({ variant: "outline" })}
          aria-disabled={totalPolicies === 0}
          tabIndex={totalPolicies === 0 ? -1 : undefined}
          onClick={(event) => {
            if (totalPolicies === 0) {
              event.preventDefault();
              return;
            }
            auditCarPolicySummaryExport(
              loaderData.dateFrom,
              loaderData.dateTo,
              summary.length,
            );
          }}
        >
          <DownloadIcon data-icon="inline-start" />
          Export Excel
        </a>
      </Form>

      <p className="mb-3 text-sm text-muted-foreground">
        {totalPolicies} polic{totalPolicies === 1 ? "y" : "ies"} created{" "}
        {formatDate(loaderData.dateFrom)} – {formatDate(loaderData.dateTo)}.
        Click a row for detail.
      </p>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Number of Policies</TableHead>
              <TableHead className="text-right">
                Total Base Premium Combined
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.every((row) => row.policyCount === 0) ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-muted-foreground"
                >
                  No policies in this period.
                </TableCell>
              </TableRow>
            ) : (
              summary.map((row) => (
                <TableRow
                  key={row.status}
                  data-state={
                    detail?.status === row.status ? "selected" : undefined
                  }
                  className="data-[state=selected]:bg-muted/50"
                >
                  <TableCell className="font-medium">
                    {row.policyCount === 0 ? (
                      row.status
                    ) : (
                      <Link
                        to={statusDetailSearch(
                          loaderData.dateFrom,
                          loaderData.dateTo,
                          row.status,
                        )}
                        className="text-foreground underline-offset-4 hover:underline"
                      >
                        {row.status}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.policyCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.totalBasePremium)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {detail != null ? (
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{detail.status}</h2>
              <p className="text-sm text-muted-foreground">
                {detail.policyCount} polic
                {detail.policyCount === 1 ? "y" : "ies"} ·{" "}
                {formatCurrency(detail.totalBasePremium)} total base premium
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`?from=${encodeURIComponent(loaderData.dateFrom)}&to=${encodeURIComponent(loaderData.dateTo)}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Close
              </Link>
              {detailExportHref ? (
                <a
                  href={detailExportHref}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  aria-disabled={detail.total === 0}
                  tabIndex={detail.total === 0 ? -1 : undefined}
                  onClick={(event) => {
                    if (detail.total === 0) {
                      event.preventDefault();
                      return;
                    }
                    auditCarPolicyDetailExport(
                      loaderData.dateFrom,
                      loaderData.dateTo,
                      detail.status,
                      detail.total,
                    );
                  }}
                >
                  <DownloadIcon data-icon="inline-start" />
                  Export Excel
                </a>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>AR Name</TableHead>
                  <TableHead>Date Quoted</TableHead>
                  <TableHead className="text-right">Base Premium</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No policies found for this status.
                    </TableCell>
                  </TableRow>
                ) : (
                  detail.rows.map((policy) => (
                    <TableRow key={policy.policyId}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/policies/${policy.policyId}`}
                          className="text-foreground underline-offset-4 hover:underline"
                        >
                          {policy.clientName}
                        </Link>
                      </TableCell>
                      <TableCell>{policy.arName || "—"}</TableCell>
                      <TableCell>{formatDate(policy.createdWhen)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(policy.basePremium)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              total={detail.total}
              page={detail.page}
              pageSize={detail.pageSize}
              pageHref={pageHref}
              pageSizeHref={pageSizeHref}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
