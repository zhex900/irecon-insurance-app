import {
  useActionData,
  useNavigate,
  useNavigation,
  useSearchParams,
} from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileTextIcon, Trash2Icon, XIcon } from "lucide-react";
import { Badge } from "~/components/reui/badge";
import { ClientSummaryPopover } from "~/components/clients/client-summary-popover";
import {
  DeletePoliciesDialog,
  type DeletablePolicyRef,
} from "~/components/policies/delete-policies-dialog";
import { NewPolicyClientDialog } from "~/components/policies/new-policy-client-dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Input } from "~/components/ui/input";
import { FilterTag, StatusBadge } from "~/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { TablePagination } from "~/components/ui/table-pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { PageHeader } from "~/components/layout/app-layout";
import { useActionSuccessToast } from "~/hooks/use-success-toast";
import { requireAuth } from "~/lib/auth/session.server";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { HighlightText } from "~/lib/search/highlight";
import { fieldMatches } from "~/lib/search/match";
import { writeAuditLog } from "~/lib/services/audit/service";
import { listPoliciesPage } from "~/lib/services/policies/list.service";
import { deletePolicies } from "~/lib/services/policy/data.service";
import { getReferenceData } from "~/lib/services/reference.service";
import { cn, formatCurrency, formatDate } from "~/lib/utils";
import { isTerminalStatus } from "~/lib/zod/policy-car";
import type { Route } from "./+types/_index";
import { pageTitle } from "~/lib/brand";

const PAGE_SIZE = 25;

export function meta() {
  return [{ title: pageTitle("Policies") }];
}

/** Always refetch when landing on the list (e.g. after creating/editing a policy). */
export function shouldRevalidate() {
  return true;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const statusParam = url.searchParams.get("status");
  const statusFilter = statusParam ? Number(statusParam) : null;
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });

  const [page, reference] = await Promise.all([
    listPoliciesPage({
      search: q,
      policyStatusId:
        statusFilter && !Number.isNaN(statusFilter) ? statusFilter : null,
      limit: pagination.limit,
      offset: pagination.offset,
    }),
    Promise.resolve(getReferenceData()),
  ]);

  const allCount = Object.values(page.statusCounts).reduce((a, b) => a + b, 0);

  return {
    policies: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    statusCounts: page.statusCounts,
    allCount,
    reference,
    q,
    statusFilter:
      statusFilter && !Number.isNaN(statusFilter) ? statusFilter : null,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent !== "delete") {
    return { ok: false as const, error: "Unknown action" };
  }

  const ids = formData
    .getAll("ids")
    .map((value) => Number(value))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (ids.length === 0) {
    return { ok: false as const, error: "No policies selected" };
  }

  try {
    const deleted = await deletePolicies(ids);
    await writeAuditLog({
      actor,
      action: "policy.delete",
      entityType: "policy",
      entityId: deleted.length === 1 ? deleted[0].policyId : undefined,
      summary:
        deleted.length === 1
          ? `Deleted policy ${deleted[0].policyNumber}`
          : `Deleted ${deleted.length} policies`,
      metadata: {
        policyIds: deleted.map((row) => row.policyId),
        policyNumbers: deleted.map((row) => row.policyNumber),
      },
      request,
    });
    return {
      ok: true as const,
      intent: "delete" as const,
      count: deleted.length,
      message:
        deleted.length === 1
          ? `Policy ${deleted[0].policyNumber} deleted`
          : `${deleted.length} policies deleted`,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

type StatusFilter = "all" | number;

export default function PoliciesIndexRoute({
  loaderData,
}: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const [search, setSearch] = useState(loaderData.q);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    loaderData.statusFilter ?? "all",
  );
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingDelete, setPendingDelete] = useState<
    DeletablePolicyRef[] | null
  >(null);
  useActionSuccessToast(actionData);

  const lastSyncKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${loaderData.q}|${loaderData.statusFilter ?? "all"}|${loaderData.page}`;
    if (lastSyncKeyRef.current === key) return;
    lastSyncKeyRef.current = key;
    setSearch(loaderData.q);
    setStatusFilter(loaderData.statusFilter ?? "all");
    setSelectedIds([]);
  }, [loaderData.q, loaderData.statusFilter, loaderData.page]);

  const handledActionDataRef = useRef(actionData);
  useEffect(() => {
    if (handledActionDataRef.current === actionData) return;
    handledActionDataRef.current = actionData;
    const handled = handledActionDataRef.current;
    if (!handled?.ok || handled.intent !== "delete") return;
    setPendingDelete(null);
    setSelectedIds([]);
  }, [actionData]);

  const deletableOnPage = useMemo(
    () =>
      loaderData.policies.filter(
        (policy) => !isTerminalStatus(policy.policyStatusId),
      ),
    [loaderData.policies],
  );

  const allDeletableSelected =
    deletableOnPage.length > 0 &&
    deletableOnPage.every((policy) => selectedIds.includes(policy.policyId));

  const selectedPolicies = useMemo(
    () =>
      loaderData.policies
        .filter((policy) => selectedIds.includes(policy.policyId))
        .map((policy) => ({
          policyId: policy.policyId,
          policyNumber: policy.policyNumber,
        })),
    [loaderData.policies, selectedIds],
  );

  function applyStatus(next: StatusFilter) {
    setStatusFilter(next);
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("status");
    else params.set("status", String(next));
    params.delete("page");
    if (search.trim()) params.set("q", search.trim());
    else params.delete("q");
    setSearchParams(params);
  }

  function commitSearch(nextSearch: string) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete("page");
      const next = nextSearch.trim();
      if (next) params.set("q", next);
      else params.delete("q");
      return params;
    });
  }

  // Auto-search as you type (same cadence as global / select-client search).
  useEffect(() => {
    const next = search.trim();
    const current = loaderData.q.trim();
    if (next === current) return;
    const timer = window.setTimeout(() => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.delete("page");
        if (next) params.set("q", next);
        else params.delete("q");
        return params;
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, loaderData.q, setSearchParams]);

  const searchQuery = loaderData.q.trim();

  const pageHref = (nextPage: number) => pageSearchHref(searchParams, nextPage);
  const pageSizeHref = (nextPageSize: number) =>
    pageSizeSearchHref(searchParams, nextPageSize, PAGE_SIZE);

  const deletingInFlight =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "delete";

  function toggleSelected(policyId: number, checked: boolean) {
    setSelectedIds((prev) =>
      checked
        ? prev.includes(policyId)
          ? prev
          : [...prev, policyId]
        : prev.filter((id) => id !== policyId),
    );
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelectedIds((prev) =>
        prev.filter(
          (id) => !deletableOnPage.some((policy) => policy.policyId === id),
        ),
      );
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const policy of deletableOnPage) next.add(policy.policyId);
      return [...next];
    });
  }

  return (
    <div>
      <PageHeader
        title="Policies"
        description="Browse and open CAR policies."
        breadcrumbs={[{ label: "Policies" }]}
        action={<NewPolicyClientDialog />}
      />

      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Input
            name="q"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search policy #, insured, client…"
            className={cn("w-full", search.trim() && "pr-9")}
            aria-label="Search policies"
          />
          {search.trim() ? (
            <button
              type="button"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                commitSearch("");
              }}
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {loaderData.total} of {loaderData.allCount} policies
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterTag
          active={statusFilter === "all"}
          onClick={() => applyStatus("all")}
        >
          All · {loaderData.allCount}
        </FilterTag>
        {loaderData.reference.policyStatuses.map((status) => (
          <FilterTag
            key={status.policyStatusId}
            active={statusFilter === status.policyStatusId}
            onClick={() => applyStatus(status.policyStatusId)}
          >
            {status.name} ·{" "}
            {loaderData.statusCounts[status.policyStatusId] ?? 0}
          </FilterTag>
        ))}
      </div>

      {selectedIds.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">{selectedIds.length}</span> selected
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setPendingDelete(selectedPolicies)}
          >
            <Trash2Icon data-icon="inline-start" />
            Delete selected
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds([])}
          >
            Clear
          </Button>
        </div>
      ) : null}

      {actionData && !actionData.ok && actionData.error && !pendingDelete ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {actionData.error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allDeletableSelected}
                  disabled={deletableOnPage.length === 0}
                  onCheckedChange={(value) => toggleSelectAll(value === true)}
                  aria-label="Select all deletable policies on this page"
                />
              </TableHead>
              <TableHead>Policy #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cover</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Inception</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-right">Premium</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loaderData.policies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileTextIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {loaderData.q ? "No match" : "No policies found"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {loaderData.q
                          ? `No match for “${loaderData.q}”.`
                          : "No policies match the current filters."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              loaderData.policies.map((policy) => {
                const status = loaderData.reference.policyStatuses.find(
                  (item) => item.policyStatusId === policy.policyStatusId,
                );
                const cover = loaderData.reference.coverTypes.find(
                  (item) => item.coverTypeId === policy.coverTypeId,
                );
                const category = loaderData.reference.policyCategories.find(
                  (item) => item.policyCategoryId === policy.policyCategoryId,
                );
                const canDelete = !isTerminalStatus(policy.policyStatusId);
                const checked = selectedIds.includes(policy.policyId);
                const showInsured =
                  Boolean(policy.insuredName) &&
                  (!searchQuery ||
                    fieldMatches(policy.insuredName, searchQuery));
                const clientNameMatches =
                  !searchQuery ||
                  fieldMatches(policy.client.name, searchQuery) ||
                  fieldMatches(policy.client.tradingName ?? "", searchQuery);
                return (
                  <TableRow
                    key={policy.policyId}
                    className="cursor-pointer"
                    onClick={() => navigate(`/policies/${policy.policyId}`)}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={checked}
                        disabled={!canDelete}
                        onCheckedChange={(value) =>
                          toggleSelected(policy.policyId, value === true)
                        }
                        aria-label={`Select ${policy.policyNumber}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {searchQuery ? (
                            <HighlightText
                              text={policy.policyNumber}
                              query={searchQuery}
                            />
                          ) : (
                            policy.policyNumber
                          )}
                        </span>
                        {policy.adjusted ? (
                          <Badge variant="info-light" size="sm">
                            Adjusted
                          </Badge>
                        ) : null}
                      </div>
                      {showInsured ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {searchQuery ? (
                            <HighlightText
                              text={policy.insuredName}
                              query={searchQuery}
                            />
                          ) : (
                            policy.insuredName
                          )}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <ClientSummaryPopover
                        client={{
                          ...policy.client,
                          accountManagerName:
                            loaderData.reference.accountManagers.find(
                              (item) =>
                                item.accountManagerId ===
                                policy.client.accountManagerId,
                            )?.fullName,
                        }}
                      >
                        {searchQuery && clientNameMatches ? (
                          fieldMatches(policy.client.name, searchQuery) ? (
                            <HighlightText
                              text={policy.client.name}
                              query={searchQuery}
                            />
                          ) : (
                            <HighlightText
                              text={
                                policy.client.tradingName || policy.client.name
                              }
                              query={searchQuery}
                            />
                          )
                        ) : (
                          policy.client.name || "—"
                        )}
                      </ClientSummaryPopover>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        statusId={policy.policyStatusId}
                        name={status?.name ?? "—"}
                      />
                    </TableCell>
                    <TableCell>{cover?.name ?? "—"}</TableCell>
                    <TableCell>{category?.name ?? "—"}</TableCell>
                    <TableCell>{formatDate(policy.dateStart)}</TableCell>
                    <TableCell>{formatDate(policy.dateEnd)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {policy.originalTotalPremium != null
                        ? formatCurrency(policy.originalTotalPremium)
                        : "—"}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          aria-label={`Delete ${policy.policyNumber}`}
                          onClick={() =>
                            setPendingDelete([
                              {
                                policyId: policy.policyId,
                                policyNumber: policy.policyNumber,
                              },
                            ])
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger
                            render={<span className="inline-flex" />}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled
                              className="text-muted-foreground"
                              aria-label={`Cannot delete ${policy.policyNumber}`}
                            >
                              <Trash2Icon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Taken and not taken policies cannot be deleted
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
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

      <DeletePoliciesDialog
        policies={pendingDelete ?? []}
        open={pendingDelete != null && pendingDelete.length > 0}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        loading={deletingInFlight}
        error={
          actionData && !actionData.ok && pendingDelete
            ? actionData.error
            : null
        }
      />
    </div>
  );
}
