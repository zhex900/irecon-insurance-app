import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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

export function meta() {
  return [{ title: "CAR Policy Report | BrokerSure" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const defaults = defaultCarPolicyPeriod();
  const dateFrom = url.searchParams.get("from") ?? defaults.dateFrom;
  const dateTo = url.searchParams.get("to") ?? defaults.dateTo;
  const summary = await getCarPolicyReportSummary(dateFrom, dateTo);
  return { summary, dateFrom, dateTo };
}

export default function CarPolicyReportRoute({
  loaderData,
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams();
  const [dateFrom, setDateFrom] = useState(loaderData.dateFrom);
  const [dateTo, setDateTo] = useState(loaderData.dateTo);
  const [detailStatus, setDetailStatus] = useState<CarSearchStatus | null>(
    null,
  );
  const [detailRows, setDetailRows] = useState<ReportPolicyRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const lastPeriodRef = useRef(`${loaderData.dateFrom}|${loaderData.dateTo}`);
  useEffect(() => {
    const key = `${loaderData.dateFrom}|${loaderData.dateTo}`;
    if (lastPeriodRef.current === key) return;
    lastPeriodRef.current = key;
    setDateFrom(loaderData.dateFrom);
    setDateTo(loaderData.dateTo);
  }, [loaderData.dateFrom, loaderData.dateTo]);

  const summary = loaderData.summary;
  const totalPolicies = useMemo(
    () => summary.reduce((n, row) => n + row.policyCount, 0),
    [summary],
  );

  const detailMeta = summary.find((row) => row.status === detailStatus) ?? null;

  const hadDetailStatusRef = useRef(false);
  const lastDetailRequestKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!detailStatus) {
      lastDetailRequestKeyRef.current = null;
      if (hadDetailStatusRef.current) {
        hadDetailStatusRef.current = false;
        setDetailRows([]);
      }
      return;
    }
    const requestKey = `${detailStatus}|${loaderData.dateFrom}|${loaderData.dateTo}`;
    if (lastDetailRequestKeyRef.current === requestKey) return;
    lastDetailRequestKeyRef.current = requestKey;
    hadDetailStatusRef.current = true;
    const controller = new AbortController();
    setDetailLoading(true);
    void (async () => {
      try {
        const params = new URLSearchParams({
          type: "report-detail",
          from: loaderData.dateFrom,
          to: loaderData.dateTo,
          status: detailStatus,
        });
        const response = await fetch(`/api/search?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to load detail");
        const data = (await response.json()) as { rows: ReportPolicyRow[] };
        setDetailRows(data.rows ?? []);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setDetailRows([]);
      } finally {
        setDetailLoading(false);
      }
    })();
    return () => controller.abort();
  }, [detailStatus, loaderData.dateFrom, loaderData.dateTo]);

  function applyPeriod() {
    const params = new URLSearchParams();
    params.set("from", dateFrom);
    params.set("to", dateTo);
    setSearchParams(params);
    setDetailStatus(null);
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

      <form
        className="mb-4 flex flex-col gap-4 rounded-xl border bg-card p-4 lg:flex-row lg:items-end lg:justify-between"
        onSubmit={(event) => {
          event.preventDefault();
          applyPeriod();
        }}
      >
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="grid gap-1.5">
            <Label htmlFor="dateFrom">Date from</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-44"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dateTo">Date to</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-44"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit">Apply</Button>
          </div>
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
      </form>

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
                  className={
                    row.policyCount > 0 ? "cursor-pointer" : "opacity-60"
                  }
                  onClick={() => {
                    if (row.policyCount > 0) setDetailStatus(row.status);
                  }}
                >
                  <TableCell className="font-medium">
                    {row.policyCount > 0 ? (
                      <span className="text-primary underline-offset-2 hover:underline">
                        {row.status}
                      </span>
                    ) : (
                      row.status
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
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Loading…
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
