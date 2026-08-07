import { Form, Link, useSearchParams } from "react-router";
import { DownloadIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
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
import { requireAuth } from "~/lib/auth/session.server";
import { pageTitle } from "~/lib/brand";
import { optionalIsoDateSchema } from "~/lib/http/route-input";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { listClientReportPage } from "~/lib/services/reports/list.service";
import { defaultClientReportPeriod } from "~/lib/services/reports/service";
import { formatCurrency, formatDate } from "~/lib/utils";
import type { Route } from "./+types/clients";

const PAGE_SIZE = 25;

export function meta() {
  return [{ title: pageTitle("Client Report") }];
}

function resolveClientReportDates(url: URL) {
  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");
  // Missing or empty params → all clients (no created-date filter).
  const dateFrom =
    rawFrom == null || rawFrom === ""
      ? ""
      : (optionalIsoDateSchema.parse(rawFrom) ?? "");
  const dateTo =
    rawTo == null || rawTo === ""
      ? ""
      : (optionalIsoDateSchema.parse(rawTo) ?? "");
  return { dateFrom, dateTo };
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const { dateFrom, dateTo } = resolveClientReportDates(url);
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

  const rangeLabel =
    !loaderData.dateFrom && !loaderData.dateTo
      ? "all dates"
      : `${loaderData.dateFrom || "…"} – ${loaderData.dateTo || "…"}`;
  const showingAllDates = !loaderData.dateFrom && !loaderData.dateTo;
  const thisMonth = defaultClientReportPeriod();

  const exportParams = new URLSearchParams();
  if (loaderData.dateFrom) exportParams.set("from", loaderData.dateFrom);
  if (loaderData.dateTo) exportParams.set("to", loaderData.dateTo);
  const exportHref = `/api/reports/clients.xlsx${
    exportParams.size > 0 ? `?${exportParams.toString()}` : ""
  }`;

  return (
    <div>
      <PageHeader
        title="Client Report"
        description="One row per client with Sub Agent, turnover limit and expiry from the latest Taken policy. Filter by client created date."
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
              <DateInput
                id="dateFrom"
                name="from"
                defaultValue={loaderData.dateFrom}
                className="w-full"
              />
            </Field>
            <Field className="sm:w-44">
              <FieldLabel htmlFor="dateTo">To</FieldLabel>
              <DateInput
                id="dateTo"
                name="to"
                defaultValue={loaderData.dateTo}
                className="w-full"
              />
            </Field>
            <Button type="submit">Apply</Button>
            {showingAllDates ? (
              <Button type="button" variant="outline" disabled>
                Show all clients
              </Button>
            ) : (
              <Link
                to="/reports/clients?from=&to="
                className={buttonVariants({ variant: "outline" })}
              >
                Show all clients
              </Link>
            )}
            {!showingAllDates ? null : (
              <Link
                to={`/reports/clients?from=${thisMonth.dateFrom}&to=${thisMonth.dateTo}`}
                className={buttonVariants({ variant: "outline" })}
              >
                This month
              </Link>
            )}
          </FieldGroup>
          <a
            href={exportHref}
            className={buttonVariants({ variant: "outline" })}
            aria-disabled={loaderData.total === 0}
            {...(loaderData.total === 0
              ? { tabIndex: -1, onClick: (e) => e.preventDefault() }
              : {})}
          >
            <DownloadIcon data-icon="inline-start" />
            Export Excel
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          {loaderData.total} client{loaderData.total === 1 ? "" : "s"} · created{" "}
          {rangeLabel}.
        </p>
      </Form>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Sub Agent</TableHead>
              <TableHead className="text-right">Turnover Limit</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Created Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loaderData.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <UsersIcon />
                      </EmptyMedia>
                      <EmptyTitle>No results</EmptyTitle>
                      <EmptyDescription>
                        No clients with a Taken policy match this created-date
                        range.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              loaderData.rows.map((row) => (
                <TableRow key={row.clientId}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/clients/${row.clientId}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{row.subAgent}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.turnoverLimit)}
                  </TableCell>
                  <TableCell>
                    {row.expiryDate ? formatDate(row.expiryDate) : "—"}
                  </TableCell>
                  <TableCell>{formatDate(row.createdDate)}</TableCell>
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
