import { useMemo, useState } from "react";
import { Form, useFetcher } from "react-router";
import { DownloadIcon } from "lucide-react";
import { PageHeader } from "~/components/layout/app-layout";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { DateInput } from "~/components/ui/date-input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { downloadCsv, toCsv } from "~/lib/csv";
import {
  defaultCarPolicyPeriod,
  type CarSearchStatus,
  type ReportPolicyRow,
} from "~/lib/services/reports/service";
import { getCarPolicyReportSummary } from "~/lib/services/reports/list.service";
import { formatCurrency, formatDate } from "~/lib/utils";
import type { Route } from "./+types/car-policies";
import { pageTitle } from "~/lib/brand";
import { requireAuth } from "~/lib/auth/session.server";
import { optionalIsoDateSchema } from "~/lib/http/route-input";

export function meta() {
  return [{ title: pageTitle("CAR Policy Report") }];
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
  const summary = await getCarPolicyReportSummary(dateFrom, dateTo);
  return { summary, dateFrom, dateTo };
}

export default function CarPolicyReportRoute({
  loaderData,
}: Route.ComponentProps) {
  const detailFetcher = useFetcher<{
    rows: ReportPolicyRow[];
    total: number;
  }>();
  const [detailStatus, setDetailStatus] = useState<CarSearchStatus | null>(
    null,
  );
  const detailRows = detailFetcher.data?.rows ?? [];
  const detailLoading = detailFetcher.state !== "idle";

  const summary = loaderData.summary;
  const totalPolicies = useMemo(
    () => summary.reduce((n, row) => n + row.policyCount, 0),
    [summary],
  );

  const detailMeta = summary.find((row) => row.status === detailStatus) ?? null;

  function openDetail(status: CarSearchStatus) {
    setDetailStatus(status);
    const params = new URLSearchParams({
      type: "report-detail",
      from: loaderData.dateFrom,
      to: loaderData.dateTo,
      status,
    });
    detailFetcher.load(`/api/search?${params}`);
  }

  function exportSummary() {
    const csv = toCsv(
      ["Status", "Number of Policies", "Total Base Premium Combined"],
      summary.map((row) => ({
        Status: row.status,
        "Number of Policies": row.policyCount,
        "Total Base Premium Combined": row.totalBasePremium.toFixed(2),
      })),
    );
    const filename = `car-policy-report-${loaderData.dateFrom}-${loaderData.dateTo}.csv`;
    downloadCsv(filename, csv);
    void import("~/lib/services/audit/client").then(
      ({ recordAuditEventClient }) => {
        recordAuditEventClient({
          action: "report.export",
          entityType: "report",
          entityId: "car-policies-summary",
          summary: `Exported CAR policy summary CSV (${summary.length} rows)`,
          metadata: {
            filename,
            dateFrom: loaderData.dateFrom,
            dateTo: loaderData.dateTo,
            rowCount: summary.length,
          },
        });
      },
    );
  }

  function exportDetail(rows: ReportPolicyRow[], statusLabel: string) {
    const csv = toCsv(
      ["Client Name", "AR Name", "Date Quoted", "Base Premium"],
      rows.map((row) => ({
        "Client Name": row.clientName,
        "AR Name": row.arName,
        "Date Quoted": formatDate(row.createdWhen),
        "Base Premium": row.basePremium.toFixed(2),
      })),
    );
    const slug = statusLabel.replace(/\s+/g, "-").toLowerCase();
    const filename = `car-policy-report-${slug}-${loaderData.dateFrom}-${loaderData.dateTo}.csv`;
    downloadCsv(filename, csv);
    void import("~/lib/services/audit/client").then(
      ({ recordAuditEventClient }) => {
        recordAuditEventClient({
          action: "report.export",
          entityType: "report",
          entityId: "car-policies-detail",
          summary: `Exported CAR policy detail CSV for ${statusLabel} (${rows.length} rows)`,
          metadata: {
            filename,
            dateFrom: loaderData.dateFrom,
            dateTo: loaderData.dateTo,
            statusLabel,
            rowCount: rows.length,
          },
        });
      },
    );
  }

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
        onSubmit={() => setDetailStatus(null)}
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
        <Button
          type="button"
          variant="outline"
          disabled={totalPolicies === 0}
          onClick={exportSummary}
        >
          <DownloadIcon data-icon="inline-start" />
          Export CSV
        </Button>
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
                <TableRow key={row.status}>
                  <TableCell className="font-medium">
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto px-0"
                      disabled={row.policyCount === 0}
                      onClick={() => openDetail(row.status)}
                    >
                      {row.status}
                    </Button>
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

      <Dialog
        open={detailStatus != null}
        onOpenChange={(open) => {
          if (!open) setDetailStatus(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>{detailStatus}</DialogTitle>
            <DialogDescription>
              {detailMeta?.policyCount ?? 0} polic
              {(detailMeta?.policyCount ?? 0) === 1 ? "y" : "ies"} ·{" "}
              {formatCurrency(detailMeta?.totalBasePremium ?? 0)} total base
              premium
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[50vh] overflow-auto rounded-lg border">
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
                {detailLoading ? (
                  <TableRow>
                    {[0, 1, 2, 3].map((column) => (
                      <TableCell key={column} className="py-4">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ) : detailRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No policies found for this status.
                    </TableCell>
                  </TableRow>
                ) : (
                  detailRows.map((policy) => (
                    <TableRow key={policy.policyId}>
                      <TableCell>{policy.clientName}</TableCell>
                      <TableCell>{policy.arName}</TableCell>
                      <TableCell>{formatDate(policy.createdWhen)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(policy.basePremium)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={detailRows.length === 0}
              onClick={() => {
                if (detailStatus) exportDetail(detailRows, detailStatus);
              }}
            >
              <DownloadIcon data-icon="inline-start" />
              Export CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
