import { Form, Link, useSearchParams } from "react-router";
import { DownloadIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "~/components/layout/app-layout";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Input } from "~/components/ui/input";
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
import { downloadCsv, toCsv } from "~/lib/csv";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { listClientReportPage } from "~/lib/services/reports/list.service";
import { defaultClientReportPeriod } from "~/lib/services/reports/service";
import { formatCurrency, formatDate } from "~/lib/utils";
import type { Route } from "./+types/clients";
import { pageTitle } from "~/lib/brand";
import { requireAuth } from "~/lib/auth/session.server";
import { optionalIsoDateSchema } from "~/lib/http/route-input";

const PAGE_SIZE = 50;

export function meta() {
  return [{ title: pageTitle("Client Report") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const defaults = defaultClientReportPeriod();
  // Missing params → this calendar year. Explicit empty string → all clients.
  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");
  const dateFrom =
    rawFrom === null
      ? defaults.dateFrom
      : (optionalIsoDateSchema.parse(rawFrom || undefined) ?? "");
  const dateTo =
    rawTo === null
      ? defaults.dateTo
      : (optionalIsoDateSchema.parse(rawTo || undefined) ?? "");
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });

  const page = await listClientReportPage({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: pagination.limit,
    offset: pagination.offset,
  });

  return {
    rows: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    dateFrom,
    dateTo,
  };
}

export default function ClientReportRoute({
  loaderData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const pageHref = (nextPage: number) => pageSearchHref(searchParams, nextPage);
  const pageSizeHref = (nextPageSize: number) =>
    pageSizeSearchHref(searchParams, nextPageSize, PAGE_SIZE);

  function exportCsv() {
    const csv = toCsv(
      ["Client Name", "Turnover Limit", "Expiry Date"],
      loaderData.rows.map((row) => ({
        "Client Name": row.clientName,
        "Turnover Limit": row.turnoverLimit,
        "Expiry Date": formatDate(row.dateEnd),
      })),
    );
    const range =
      loaderData.dateFrom || loaderData.dateTo
        ? `${loaderData.dateFrom || "all"}-${loaderData.dateTo || "all"}`
        : "all";
    const filename = `client-report-${range}-page-${loaderData.page}.csv`;
    downloadCsv(filename, csv);
    void import("~/lib/services/audit/client").then(
      ({ recordAuditEventClient }) => {
        recordAuditEventClient({
          action: "report.export",
          entityType: "report",
          entityId: "clients",
          summary: `Exported client report CSV (${loaderData.rows.length} rows)`,
          metadata: {
            filename,
            dateFrom: loaderData.dateFrom,
            dateTo: loaderData.dateTo,
            rowCount: loaderData.rows.length,
          },
        });
      },
    );
  }

  const rangeLabel =
    !loaderData.dateFrom && !loaderData.dateTo
      ? "all dates"
      : `${loaderData.dateFrom || "…"} – ${loaderData.dateTo || "…"}`;

  return (
    <div>
      <PageHeader
        title="Client Report"
        description="Client policies with turnover limit and expiry. Clear dates to show all."
        breadcrumbs={[
          { label: "Reports", to: "/reports" },
          { label: "Client Report" },
        ]}
      />

      <Form
        key={`${loaderData.dateFrom}|${loaderData.dateTo}`}
        method="get"
        className="mb-4 flex flex-col gap-4 rounded-xl border bg-card p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <FieldGroup className="flex-1 gap-3 sm:flex-row sm:items-end">
            <Field className="sm:w-44">
              <FieldLabel htmlFor="dateFrom">From</FieldLabel>
              <Input
                id="dateFrom"
                name="from"
                type="date"
                defaultValue={loaderData.dateFrom}
                className="w-full"
              />
            </Field>
            <Field className="sm:w-44">
              <FieldLabel htmlFor="dateTo">To</FieldLabel>
              <Input
                id="dateTo"
                name="to"
                type="date"
                defaultValue={loaderData.dateTo}
                className="w-full"
              />
            </Field>
            <Button type="submit">Apply</Button>
          </FieldGroup>
          <Button
            type="button"
            variant="outline"
            disabled={loaderData.total === 0}
            onClick={exportCsv}
          >
            <DownloadIcon data-icon="inline-start" />
            Export CSV
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {loaderData.total} polic
          {loaderData.total === 1 ? "y" : "ies"} · expiry {rangeLabel}. Leave
          dates empty for all clients.
        </p>
      </Form>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead className="text-right">Turnover Limit</TableHead>
              <TableHead>Expiry Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loaderData.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-10">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <UsersIcon />
                      </EmptyMedia>
                      <EmptyTitle>No clients found</EmptyTitle>
                      <EmptyDescription>
                        No clients match this date range.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              loaderData.rows.map((row) => (
                <TableRow key={row.policyId}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/clients/${row.clientId}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {row.clientName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.turnoverLimit)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDate(row.dateEnd)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          total={loaderData.total}
          page={loaderData.page}
          pageSize={loaderData.pageSize}
          pageHref={pageHref}
          pageSizeHref={pageSizeHref}
        />
      </div>
    </div>
  );
}
