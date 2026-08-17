import { useMemo } from "react";

import { useOptionalApi } from "~/hooks/network/use-optional-api";
import {
  buildPolicyListMetaUrl,
  policyListMetaKey,
} from "~/lib/search/policy-list-meta-api";
import type { PolicyListMetaResponse } from "~/lib/services/policies/list.service";

/** Load filter badge counts via `/api/policies/list-meta` when list filters change. */
export function usePolicyListMeta(searchParams: URLSearchParams) {
  const metaKey = useMemo(
    () => policyListMetaKey(searchParams),
    [searchParams],
  );
  const url = useMemo(
    () => buildPolicyListMetaUrl(new URLSearchParams(metaKey)),
    [metaKey],
  );

  const { data, pending } = useOptionalApi<PolicyListMetaResponse>(url);

  return {
    meta: data,
    countsPending: pending,
    statusCounts: data?.statusCounts,
    coverCounts: data?.coverCounts,
    categoryCounts: data?.categoryCounts,
    inceptionPresetCounts: data?.inceptionPresetCounts,
    expiryPresetCounts: data?.expiryPresetCounts,
    allCount: data?.allCount ?? null,
  };
}
