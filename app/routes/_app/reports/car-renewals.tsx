import { DownloadIcon, FileTextIcon } from "lucide-react";
import { useState } from "react";
import { Form, useSearchParams } from "react-router";

import { PageHeader } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DateInput } from "~/components/ui/date-input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
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
import { optionalIsoDateSchema, queryTextSchema } from "~/lib/http/route-input";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { parseIdListParam } from "~/lib/search/id-list-param";
import { recordAuditEventClient } from "~/lib/services/audit/client";
import { getReferenceData } from "~/lib/services/reference.service";
import { listReportPoliciesPage } from "~/lib/services/reports/list.service";
import { dueNextDays, todayIsoDate } from "~/lib/services/reports/service";
import { formatDate } from "~/lib/utils";
import { POLICY_STATUS } from "~/lib/zod/policy-car";

import type { Route } from "./+types/car-renewals";

const PAGE_SIZE = 50;

export function meta() {
  return [{ title: pageTitle("CAR Renewal Report") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const reference = getReferenceData();
  const referenceDate =
    optionalIsoDateSchema.parse(url.searchParams.get("ref") ?? undefined) ??
    todayIsoDate();
  const search = queryTextSchema.parse(url.searchParams.get("q") ?? "");
  const parsedStatusIds = parseIdListParam(url.searchParams.get("status"));
  const statusIds = parsedStatusIds.length
    ? parsedStatusIds
    : [POLICY_STATUS.Taken, POLICY_STATUS.Pending, POLICY_STATUS.NotTaken];
  const parsedCategoryIds = parseIdListParam(url.searchParams.get("type"));
  const policyCategoryIds = parsedCategoryIds.length
    ? parsedCategoryIds
    : [1, 2];
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });

  const page = await listReportPoliciesPage({
    search: search || undefined,
    statusIds,
    policyCategoryIds,
    orderBy: "dateEnd",
    limit: pagination.limit,
    offset: pagination.offset,
  });

  const rows = page.rows.map((row) => ({
    ...row,
    dueNextDays: dueNextDays(referenceDate, row.dateEnd),
  }));

  return {
    rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    reference,
    referenceDate,
    search,
    statusIds,
    policyCategoryIds,
  };
}

function toggleId(list: number[], id: number, checked: boolean): number[] {
  if (checked) return list.includes(id) ? list : [...list, id];
  return list.filter((item) => item !== id);
}

function auditCarRenewalExport(input: {
  referenceDate: string;
  rowCount: number;
  search: string;
  statusIds: number[];
  policyCategoryIds: number[];
}) {
  recordAuditEventClient({
    action: "report.export",
    entityType: "report",
    entityId: "car-renewals",
    summary: `Exported CAR renewal Excel (${input.rowCount} rows)`,
    metadata: {
      filename: `car-renewal-report-${input.referenceDate}.xlsx`,
      referenceDate: input.referenceDate,
      rowCount: input.rowCount,
      search: input.search || undefined,
      statusIds: input.statusIds,
      policyCategoryIds: input.policyCategoryIds,
    },
  });
}

export default function CarRenewalReportRoute({
  loaderData,
}: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [referenceDate, setReferenceDate] = useState(loaderData.referenceDate);
  const [search, setSearch] = useState(loaderData.search);
  const [statusIds, setStatusIds] = useState<number[]>(loaderData.statusIds);
  const [policyCategoryIds, setPolicyCategoryIds] = useState<number[]>(
    loaderData.policyCategoryIds,
  );

  const results = loaderData.rows;

  function applyFilters(event?: React.FormEvent) {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (referenceDate) params.set("ref", referenceDate);
    if (search.trim()) params.set("q", search.trim());
    if (statusIds.length) params.set("status", statusIds.join(","));
    if (policyCategoryIds.length)
      params.set("type", policyCategoryIds.join(","));
    setSearchParams(params);
  }

  const pageHref = (nextPage: number) => pageSearchHref(searchParams, nextPage);
  const pageSizeHref = (nextPageSize: number) =>
    pageSizeSearchHref(searchParams, nextPageSize, PAGE_SIZE);

  const exportParams = new URLSearchParams(searchParams);
  exportParams.delete("page");
  exportParams.delete("pageSize");
  const exportHref = `/api/reports/car-renewals.xlsx?${exportParams.toString()}`;

  return (
    <div>
      <PageHeader
        title="CAR Renewal Report"
        description="Policies relative to a reference date — filter by status, type, and search."
        breadcrumbs={[
          { label: "Reports", to: "/reports" },
          { label: "CAR Renewal Report" },
        ]}
      />

      <Form
        key={`${loaderData.referenceDate}|${loaderData.search}|${loaderData.statusIds.join(",")}|${loaderData.policyCategoryIds.join(",")}`}
        method="get"
        onSubmit={applyFilters}
        className="mb-4 flex flex-col gap-4 rounded-xl border bg-card p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <FieldGroup className="flex-1 gap-3 sm:flex-row">
            <Field className="sm:w-44">
              <FieldLabel htmlFor="referenceDate">Reference date</FieldLabel>
              <DateInput
                id="referenceDate"
                value={referenceDate}
                onChange={setReferenceDate}
                className="w-full"
              />
            </Field>
            <Field className="min-w-0 flex-1">
              <FieldLabel htmlFor="renewalSearch">Search</FieldLabel>
              <Input
                id="renewalSearch"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Client, AR, policy #…"
                className="max-w-md"
              />
            </Field>
          </FieldGroup>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Apply</Button>
            <a
              href={exportHref}
              className={buttonVariants({ variant: "outline" })}
              aria-disabled={loaderData.total === 0}
              tabIndex={loaderData.total === 0 ? -1 : undefined}
              onClick={(event) => {
                if (loaderData.total === 0) {
                  event.preventDefault();
                  return;
                }
                auditCarRenewalExport({
                  referenceDate: loaderData.referenceDate,
                  rowCount: loaderData.total,
                  search: loaderData.search,
                  statusIds: loaderData.statusIds,
                  policyCategoryIds: loaderData.policyCategoryIds,
                });
              }}
            >
              <DownloadIcon data-icon="inline-start" />
              Export Excel
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Status</legend>
            <div className="flex flex-wrap gap-4">
              {loaderData.reference.policyStatuses.map((status) => {
                const checked = statusIds.includes(status.policyStatusId);
                return (
                  <label
                    key={status.policyStatusId}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        setStatusIds((prev) =>
                          toggleId(prev, status.policyStatusId, value === true),
                        )
                      }
                    />
                    {status.name}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Category</legend>
            <div className="flex flex-wrap gap-4">
              {loaderData.reference.policyCategories.map((type) => {
                const checked = policyCategoryIds.includes(
                  type.policyCategoryId,
                );
                return (
                  <label
                    key={type.policyCategoryId}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        setPolicyCategoryIds((prev) =>
                          toggleId(prev, type.policyCategoryId, value === true),
                        )
                      }
                    />
                    {type.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </Form>

      <p className="mb-3 text-sm text-muted-foreground">
        {loaderData.total} result{loaderData.total === 1 ? "" : "s"} · due days
        relative to {formatDate(loaderData.referenceDate)}
      </p>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>AR</TableHead>
              <TableHead>AR Email</TableHead>
              <TableHead className="text-right">Due Next Days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileTextIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {loaderData.search.trim()
                          ? "No match"
                          : "No policies found"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {loaderData.search.trim()
                          ? `No match for “${loaderData.search.trim()}”.`
                          : "No policies match the current filters."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              results.map((row) => (
                <TableRow key={row.policyId}>
                  <TableCell>{row.statusName}</TableCell>
                  <TableCell>{row.policyCategoryName}</TableCell>
                  <TableCell className="font-medium">
                    {row.clientName}
                  </TableCell>
                  <TableCell>{formatDate(row.dateEnd)}</TableCell>
                  <TableCell>{row.arName || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.arEmail || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.dueNextDays}
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
