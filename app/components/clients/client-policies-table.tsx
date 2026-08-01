import { useActionData, useNavigation, useSearchParams } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { FileTextIcon, Trash2Icon, XIcon } from "lucide-react";
import { Badge } from "~/components/reui/badge";
import {
  DeletePoliciesDialog,
  type DeletablePolicyRef,
} from "~/components/policies/delete-policies-dialog";
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
import type { PolicyListItem } from "~/lib/services/policies/list.service";
import type { ReferenceData } from "~/lib/db/types";
import { pageSearchHref, pageSizeSearchHref } from "~/lib/pagination";
import { HighlightText } from "~/lib/search/highlight";
import { fieldMatches } from "~/lib/search/match";
import { cn, formatCurrency, formatDate } from "~/lib/utils";
import { isTerminalStatus } from "~/lib/zod/policy-car";
import { useActionSuccessToast } from "~/hooks/use-success-toast";

const DEFAULT_PAGE_SIZE = 25;

type StatusFilter = "all" | number;

type PoliciesDeleteActionData =
  | {
      ok: true;
      intent: "delete-policies";
      count: number;
      message?: string;
    }
  | { ok: false; error: string };

export function ClientPoliciesTable({
  policies,
  total,
  page,
  pageSize,
  statusCounts,
  allCount,
  q,
  statusFilter: statusFilterProp,
  reference,
}: {
  policies: PolicyListItem[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<number, number>;
  allCount: number;
  q: string;
  statusFilter: number | null;
  reference: ReferenceData;
}) {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData() as PoliciesDeleteActionData | undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(q);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    statusFilterProp ?? "all",
  );
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingDelete, setPendingDelete] = useState<
    DeletablePolicyRef[] | null
  >(null);
  useActionSuccessToast(actionData);

  const lastSyncKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${q}|${statusFilterProp ?? "all"}|${page}`;
    if (lastSyncKeyRef.current === key) return;
    lastSyncKeyRef.current = key;
    setSearch(q);
    setStatusFilter(statusFilterProp ?? "all");
    setSelectedIds([]);
  }, [q, statusFilterProp, page]);

  const handledActionDataRef = useRef<PoliciesDeleteActionData | undefined>(
    undefined,
  );
  useEffect(() => {
    if (handledActionDataRef.current === actionData) return;
    handledActionDataRef.current = actionData;
    const handled = handledActionDataRef.current;
    if (!handled?.ok || handled.intent !== "delete-policies") return;
    setPendingDelete(null);
    setSelectedIds([]);
  }, [actionData]);

  const deletableOnPage = useMemo(
    () => policies.filter((policy) => !isTerminalStatus(policy.policyStatusId)),
    [policies],
  );

  const allDeletableSelected =
    deletableOnPage.length > 0 &&
    deletableOnPage.every((policy) => selectedIds.includes(policy.policyId));

  const selectedPolicies = useMemo(
    () =>
      policies
        .filter((policy) => selectedIds.includes(policy.policyId))
        .map((policy) => ({
          policyId: policy.policyId,
          policyNumber: policy.policyNumber,
        })),
    [policies, selectedIds],
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

  // Auto-search as you type (same cadence as policies / clients lists).
  useEffect(() => {
    const next = search.trim();
    const current = q.trim();
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
  }, [search, q, setSearchParams]);

  const searchQuery = q.trim();

  const pageHref = (nextPage: number) => pageSearchHref(searchParams, nextPage);
  const pageSizeHref = (nextPageSize: number) =>
    pageSizeSearchHref(searchParams, nextPageSize, DEFAULT_PAGE_SIZE);

  const deletingInFlight =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "delete-policies";

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

  if (allCount === 0) {
    return (
      <Empty className="border border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileTextIcon />
          </EmptyMedia>
          <EmptyTitle>No policies yet</EmptyTitle>
          <EmptyDescription>No policies yet for this client.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-sm shrink-0">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search policy #, insured, cover…"
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
        <div className="flex flex-wrap items-center justify-end gap-2 lg:ms-auto">
          <FilterTag
            active={statusFilter === "all"}
            onClick={() => applyStatus("all")}
          >
            All · {allCount}
          </FilterTag>
          {reference.policyStatuses.map((status) => (
            <FilterTag
              key={status.policyStatusId}
              active={statusFilter === status.policyStatusId}
              onClick={() => applyStatus(status.policyStatusId)}
            >
              {status.name} · {statusCounts[status.policyStatusId] ?? 0}
            </FilterTag>
          ))}
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
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

      <div className="overflow-hidden rounded-lg border">
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
            {policies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileTextIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {q ? "No match" : "No policies found"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {q
                          ? `No match for “${q}”.`
                          : "No policies match the current filters."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              policies.map((policy) => {
                const status = reference.policyStatuses.find(
                  (item) => item.policyStatusId === policy.policyStatusId,
                );
                const cover = reference.coverTypes.find(
                  (item) => item.coverTypeId === policy.coverTypeId,
                );
                const category = reference.policyCategories.find(
                  (item) => item.policyCategoryId === policy.policyCategoryId,
                );
                const canDelete = !isTerminalStatus(policy.policyStatusId);
                const checked = selectedIds.includes(policy.policyId);
                const showInsured =
                  Boolean(policy.insuredName) &&
                  (!searchQuery ||
                    fieldMatches(policy.insuredName, searchQuery));
                const coverName = cover?.name ?? "";
                const categoryName = category?.name ?? "";
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
                        {policy.isDraft ? (
                          <Badge variant="warning-light" size="sm">
                            Draft
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
                    <TableCell>
                      <StatusBadge
                        statusId={policy.policyStatusId}
                        name={status?.name ?? "—"}
                      />
                    </TableCell>
                    <TableCell>
                      {coverName ? (
                        searchQuery && fieldMatches(coverName, searchQuery) ? (
                          <HighlightText text={coverName} query={searchQuery} />
                        ) : (
                          coverName
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {categoryName ? (
                        searchQuery &&
                        fieldMatches(categoryName, searchQuery) ? (
                          <HighlightText
                            text={categoryName}
                            query={searchQuery}
                          />
                        ) : (
                          categoryName
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
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
          total={total}
          page={page}
          pageSize={pageSize}
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
        intent="delete-policies"
        error={
          actionData && !actionData.ok && pendingDelete
            ? actionData.error
            : null
        }
      />
    </div>
  );
}
