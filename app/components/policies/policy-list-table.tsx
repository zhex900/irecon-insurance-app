import { useNavigate } from "react-router";
import { FileTextIcon, Trash2Icon } from "lucide-react";
import {
  ColumnClientFilterHeader,
  type ColumnClientFilterOption,
} from "~/components/forms/column-client-filter-header";
import { ColumnDateFilterHeader } from "~/components/forms/column-date-filter-header";
import { ColumnFilterHeader } from "~/components/forms/column-filter-header";
import {
  DeletePoliciesDialog,
  type DeletablePolicyRef,
} from "~/components/policies/delete-policies-dialog";
import { PolicyListTableRow } from "~/components/policies/policy-list-table-row";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { TablePagination } from "~/components/ui/table-pagination";
import type { PolicyListSelection } from "~/hooks/use-policy-list-selection";
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
import {
  withDateRangeParam,
  withIdListParam,
  type PolicyListUrlFilters,
} from "~/lib/search/policy-list-filters";
import type { PolicyListItem } from "~/lib/services/policies/list.service";

export type PolicyListTableProps = {
  policies: PolicyListItem[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<number, number>;
  coverCounts: Record<number, number>;
  categoryCounts: Record<number, number>;
  inceptionPresetCounts: Record<string, number>;
  expiryPresetCounts: Record<string, number>;
  q: string;
  searchQuery: string;
  filters: Pick<
    PolicyListUrlFilters,
    "statusIds" | "coverTypeIds" | "policyCategoryIds" | "inception" | "expiry"
  >;
  reference: ReferenceData;
  selection: PolicyListSelection;
  search: string;
  searchParams: URLSearchParams;
  setSearchParams: (
    params: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
    options?: { replace?: boolean },
  ) => void;
  defaultPageSize?: number;
  deleteIntent?: string;
  showClientColumn?: boolean;
  showDraftBadge?: boolean;
  clientFilter?: {
    selected: string[];
    selectedOptions: ColumnClientFilterOption[];
    countQuery: string;
  };
  dateInputIdPrefix?: string;
  variant?: "card" | "plain";
};

function PolicyListBulkBar({
  selectedCount,
  selectedPolicies,
  onDelete,
  onClear,
  className,
}: {
  selectedCount: number;
  selectedPolicies: DeletablePolicyRef[];
  onDelete: (policies: DeletablePolicyRef[]) => void;
  onClear: () => void;
  className?: string;
}) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={
        className ??
        "mb-3 flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3"
      }
    >
      <p className="text-sm">
        <span className="font-medium">{selectedCount}</span> selected
      </p>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => onDelete(selectedPolicies)}
      >
        <Trash2Icon data-icon="inline-start" />
        Delete selected
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

export function PolicyListTable({
  policies,
  total,
  page,
  pageSize,
  statusCounts,
  coverCounts,
  categoryCounts,
  inceptionPresetCounts,
  expiryPresetCounts,
  q,
  searchQuery,
  filters,
  reference,
  selection,
  search,
  searchParams,
  setSearchParams,
  defaultPageSize = 25,
  deleteIntent = "delete",
  showClientColumn = false,
  showDraftBadge = false,
  clientFilter,
  dateInputIdPrefix = "inception",
  variant = "card",
}: PolicyListTableProps) {
  const navigate = useNavigate();
  const {
    selectedIds,
    setSelectedIds,
    pendingDelete,
    setPendingDelete,
    deletableOnPage,
    allDeletableSelected,
    selectedPolicies,
    toggleSelected,
    toggleSelectAll,
    deletingInFlight,
    actionData,
  } = selection;

  const columnCount =
    8 + (showClientColumn ? 1 : 0) + 1; /* checkbox + actions */

  function keepSearch(params: URLSearchParams) {
    if (search.trim()) params.set("q", search.trim());
    else params.delete("q");
    return params;
  }

  function applyColumnFilter(
    key: "status" | "cover" | "category" | "client",
    nextIds: Array<number | string>,
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
    pageSizeSearchHref(searchParams, nextPageSize, defaultPageSize);

  const tableShellClassName =
    variant === "card"
      ? "overflow-hidden rounded-xl border bg-card"
      : "overflow-hidden rounded-lg border";

  const bulkBarClassName =
    variant === "card"
      ? undefined
      : "flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3";

  return (
    <>
      <PolicyListBulkBar
        selectedCount={selectedIds.length}
        selectedPolicies={selectedPolicies}
        onDelete={setPendingDelete}
        onClear={() => setSelectedIds([])}
        className={bulkBarClassName}
      />

      <div className={tableShellClassName}>
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
              {showClientColumn && clientFilter ? (
                <TableHead>
                  <ColumnClientFilterHeader
                    selected={clientFilter.selected}
                    selectedOptions={clientFilter.selectedOptions}
                    countQuery={clientFilter.countQuery}
                    onChange={(next) => applyColumnFilter("client", next)}
                  />
                </TableHead>
              ) : null}
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
                  inputIdPrefix={dateInputIdPrefix}
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
                  inputIdPrefix={dateInputIdPrefix.replace(
                    "inception",
                    "expiry",
                  )}
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
                <TableCell colSpan={columnCount} className="py-10">
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
              policies.map((policy) => (
                <PolicyListTableRow
                  key={policy.policyId}
                  policy={policy}
                  reference={reference}
                  searchQuery={searchQuery}
                  showClientColumn={showClientColumn}
                  showDraftBadge={showDraftBadge}
                  selected={selectedIds.includes(policy.policyId)}
                  onToggleSelected={toggleSelected}
                  onActivate={() => navigate(`/policies/${policy.policyId}`)}
                  onDeleteRequest={(item) => setPendingDelete([item])}
                />
              ))
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
        intent={deleteIntent}
        error={
          actionData && !actionData.ok && pendingDelete
            ? actionData.error
            : null
        }
      />
    </>
  );
}
