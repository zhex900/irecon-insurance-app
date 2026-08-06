import { useDebouncedSearchQuery } from "~/hooks/use-debounced-search-query";
import { usePolicyListSelection } from "~/hooks/use-policy-list-selection";
import {
  policyListFiltersKey,
  type PolicyListUrlFilters,
} from "~/lib/search/policy-list-filters";
import type { PolicyListItem } from "~/lib/services/policies/list.service";

type PolicyListPageFilters = Pick<
  PolicyListUrlFilters,
  "statusIds" | "coverTypeIds" | "policyCategoryIds" | "inception" | "expiry"
> & {
  clientIds?: string[];
};

export function usePolicyListPage({
  q,
  filters,
  policies,
  page,
  deleteIntent,
}: {
  q: string;
  filters: PolicyListPageFilters;
  policies: PolicyListItem[];
  page: number;
  deleteIntent: string;
}) {
  const search = useDebouncedSearchQuery(q);

  const filterKey = policyListFiltersKey({
    q,
    clientIds: filters.clientIds ?? [],
    statusIds: filters.statusIds,
    coverTypeIds: filters.coverTypeIds,
    policyCategoryIds: filters.policyCategoryIds,
    inception: filters.inception,
    expiry: filters.expiry,
  });

  const selection = usePolicyListSelection({
    policies,
    syncKey: `${q}|${filterKey}|${page}`,
    deleteIntent,
  });

  return {
    ...search,
    filterKey,
    selection,
  };
}
