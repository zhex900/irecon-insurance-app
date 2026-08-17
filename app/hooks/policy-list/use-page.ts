import { useDebouncedSearchQuery } from "~/hooks/search";
import {
  policyListFiltersKey,
  type PolicyListUrlFilters,
} from "~/lib/search/policy-list-filters";
import type { PolicyListItem } from "~/lib/services/policies/list.service";

import { usePolicyListSelection } from "./use-selection";

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
