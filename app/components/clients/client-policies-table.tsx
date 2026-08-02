import { useActionData, useNavigate, useNavigation } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileTextIcon, Trash2Icon } from "lucide-react";
import { ColumnDateFilterHeader } from "~/components/forms/column-date-filter-header";
import { ColumnFilterHeader } from "~/components/forms/column-filter-header";
import { ListSearchField } from "~/components/forms/list-search-field";
import {
  DeletePoliciesDialog,
  type DeletablePolicyRef,
} from "~/components/policies/delete-policies-dialog";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { StatusBadge } from "~/components/ui/status-badge";
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
import { useActionSuccessToast } from "~/hooks/use-success-toast";
import { useDebouncedSearchQuery } from "~/hooks/use-debounced-search-query";
import type { ReferenceData } from "~/lib/db/types";
import { pageSearchHref, pageSizeSearchHref } from "~/lib/pagination";
import {
  EXPIRY_PRESETS,
  INCEPTION_PRESETS,
  rangeForExpiryPreset,
  rangeForInceptionPreset,
  type DateRangeValue,
  type ExpiryPresetId,
  type InceptionPresetId,
} from "~/lib/search/date-range-filter";
import { SearchHighlight } from "~/lib/search/highlight-cell";
import { fieldMatches } from "~/lib/search/match";
import {
  policyListFiltersKey,
  withDateRangeParam,
  withIdListParam,
  type PolicyListUrlFilters,
} from "~/lib/search/policy-list-filters";
import type { PolicyListItem } from "~/lib/services/policies/list.service";
import { formatCurrency, formatDate } from "~/lib/utils";
import { isTerminalStatus } from "~/lib/zod/policy-car";

const DEFAULT_PAGE_SIZE = 25;

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
  coverCounts,
  categoryCounts,
  inceptionPresetCounts,
  expiryPresetCounts,
  allCount,
  policyCount,
  q,
  filters,
  reference,
}: {
  policies: PolicyListItem[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<number, number>;
  coverCounts: Record<number, number>;
  categoryCounts: Record<number, number>;
  inceptionPresetCounts: Record<string, number>;
  expiryPresetCounts: Record<string, number>;
  allCount: number;
  /** Unfiltered policy count for this client (empty-state gate). */
  policyCount: number;
  q: string;
  filters: Pick<
    PolicyListUrlFilters,
    "statusIds" | "coverTypeIds" | "policyCategoryIds" | "inception" | "expiry"
  >;
  reference: ReferenceData;
}) {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData() as PoliciesDeleteActionData | undefined;
  const {
    search,
    setSearch,
    clearSearch,
    searchQuery,
    searchParams,
    setSearchParams,
  } = useDebouncedSearchQuery(q);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingDelete, setPendingDelete] = useState<
    DeletablePolicyRef[] | null
  >(null);
  useActionSuccessToast(actionData);

  const filterKey = policyListFiltersKey({
    q,
    clientIds: [],
    ...filters,
  });

  const lastSyncKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${q}|${filterKey}|${page}`;
    if (lastSyncKeyRef.current === key) return;
    lastSyncKeyRef.current = key;
    setSelectedIds([]);
  }, [q, filterKey, page]);

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

  function keepSearch(params: URLSearchParams) {
    if (search.trim()) params.set("q", search.trim());
    else params.delete("q");
    return params;
  }

  function applyColumnFilter(
    key: "status" | "cover" | "category",
    nextIds: number[],
  ) {
    setSearchParams(keepSearch(withIdListParam(searchParams, key, nextIds)));
  }

  function applyDateRangeFilter(
    key: "inception" | "expiry",
    next: DateRangeValue,
  ) {
    setSearchParams(keepSearch(withDateRangeParam(searchParams, key, next)));
  }

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

  if (policyCount === 0) {
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
        <ListSearchField
          value={search}
          onChange={setSearch}
          onClear={clearSearch}
          placeholder="Search policy #, insured…"
          aria-label="Search policies"
          className="max-w-sm shrink-0"
        />
        <p className="text-sm text-muted-foreground lg:ms-auto">
          {total} of {allCount} policies
        </p>
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
              <TableHead>
                <ColumnFilterHeader
                  label="Status"
                  selected={filters.statusIds.map(String)}
                  onChange={(next) =>
                    applyColumnFilter(
                      "status",
                      next.map(Number).filter((id) => id > 0),
                    )
                  }
                  options={reference.policyStatuses.map((status) => ({
                    value: String(status.policyStatusId),
                    label: status.name,
                    count: statusCounts[status.policyStatusId] ?? 0,
                  }))}
                />
              </TableHead>
              <TableHead>
                <ColumnFilterHeader
                  label="Cover"
                  selected={filters.coverTypeIds.map(String)}
                  onChange={(next) =>
                    applyColumnFilter(
                      "cover",
                      next.map(Number).filter((id) => id > 0),
                    )
                  }
                  options={reference.coverTypes.map((cover) => ({
                    value: String(cover.coverTypeId),
                    label: cover.name,
                    count: coverCounts[cover.coverTypeId] ?? 0,
                  }))}
                />
              </TableHead>
              <TableHead>
                <ColumnFilterHeader
                  label="Category"
                  selected={filters.policyCategoryIds.map(String)}
                  onChange={(next) =>
                    applyColumnFilter(
                      "category",
                      next.map(Number).filter((id) => id > 0),
                    )
                  }
                  options={reference.policyCategories.map((category) => ({
                    value: String(category.policyCategoryId),
                    label: category.name,
                    count: categoryCounts[category.policyCategoryId] ?? 0,
                  }))}
                />
              </TableHead>
              <TableHead>
                <ColumnDateFilterHeader
                  label="Inception"
                  inputIdPrefix="client-inception"
                  presets={INCEPTION_PRESETS}
                  value={filters.inception}
                  presetCounts={inceptionPresetCounts}
                  rangeForPreset={(preset) =>
                    rangeForInceptionPreset(preset as InceptionPresetId)
                  }
                  onChange={(next) => applyDateRangeFilter("inception", next)}
                />
              </TableHead>
              <TableHead>
                <ColumnDateFilterHeader
                  label="Expiry"
                  inputIdPrefix="client-expiry"
                  presets={EXPIRY_PRESETS}
                  value={filters.expiry}
                  presetCounts={expiryPresetCounts}
                  rangeForPreset={(preset) =>
                    rangeForExpiryPreset(preset as ExpiryPresetId)
                  }
                  onChange={(next) => applyDateRangeFilter("expiry", next)}
                />
              </TableHead>
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
                            <SearchHighlight
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
                            <SearchHighlight
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
