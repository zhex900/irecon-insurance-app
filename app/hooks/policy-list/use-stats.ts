import { useMemo } from "react";

import { useOptionalApi } from "~/hooks/network/use-optional-api";
import {
  buildPolicyListStatsUrl,
  policyListStatsKey,
} from "~/lib/search/policy-list-stats-api";
import type { PolicyListStatsResponse } from "~/lib/services/policies/list.service";
import type { ListReferenceData } from "~/lib/services/reference.service";

/** Load filter badge counts + live AM/AR in one `/api/policies/list-stats` request. */
export function usePolicyListStats(searchParams: URLSearchParams) {
  const statsKey = useMemo(
    () => policyListStatsKey(searchParams),
    [searchParams],
  );
  const url = useMemo(
    () => buildPolicyListStatsUrl(new URLSearchParams(statsKey)),
    [statsKey],
  );

  const { data, pending } = useOptionalApi<PolicyListStatsResponse>(url);

  return {
    meta: data?.meta,
    reference: data?.reference ?? null,
    countsPending: pending,
    statusCounts: data?.meta?.statusCounts,
    coverCounts: data?.meta?.coverCounts,
    categoryCounts: data?.meta?.categoryCounts,
    inceptionPresetCounts: data?.meta?.inceptionPresetCounts,
    expiryPresetCounts: data?.meta?.expiryPresetCounts,
    allCount: data?.meta?.allCount ?? null,
  };
}

export type { ListReferenceData };
