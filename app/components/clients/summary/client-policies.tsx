import { FileTextIcon } from "lucide-react";
import { ListSearchField } from "~/components/forms/list-search-field";
import { PolicyListTable } from "~/components/policies/policy-list-table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { useActionSuccessToast } from "~/hooks/utilities";
import { usePolicyListPage } from "~/hooks/policy-list/use-page";
import type { ReferenceData } from "~/lib/db/types";
import type { PolicyListUrlFilters } from "~/lib/search/policy-list-filters";
import type { PolicyListItem } from "~/lib/services/policies/list.service";

const DEFAULT_PAGE_SIZE = 25;

export function ClientPolicies({
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
  const {
    search,
    setSearch,
    clearSearch,
    searchQuery,
    searchParams,
    setSearchParams,
    selection,
  } = usePolicyListPage({
    q,
    filters,
    policies,
    page,
    deleteIntent: "delete-policies",
  });

  useActionSuccessToast(selection.actionData);

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
        <div className="flex flex-col gap-1 text-sm text-muted-foreground lg:items-end">
          <p>
            {total} of {allCount} policies
          </p>
        </div>
      </div>

      <PolicyListTable
        policies={policies}
        total={total}
        page={page}
        pageSize={pageSize}
        statusCounts={statusCounts}
        coverCounts={coverCounts}
        categoryCounts={categoryCounts}
        inceptionPresetCounts={inceptionPresetCounts}
        expiryPresetCounts={expiryPresetCounts}
        q={q}
        searchQuery={searchQuery}
        filters={filters}
        reference={reference}
        selection={selection}
        search={search}
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        defaultPageSize={DEFAULT_PAGE_SIZE}
        deleteIntent="delete-policies"
        showDraftBadge
        dateInputIdPrefix="client-inception"
        variant="plain"
      />
    </div>
  );
}
