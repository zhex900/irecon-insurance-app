import { useEffect, useMemo, useRef } from "react";
import { useFetcher } from "react-router";

import {
  buildPolicyListMetaUrl,
  policyListMetaKey,
} from "~/lib/search/policy-list-meta-api";
import type { PolicyListMetaResponse } from "~/lib/services/policies/list.service";

/** Load filter badge counts via `/api/policies/list-meta` when list filters change. */
export function usePolicyListMeta(searchParams: URLSearchParams) {
  const fetcher = useFetcher<PolicyListMetaResponse>();
  const loadRef = useRef(fetcher.load);
  useEffect(() => {
    loadRef.current = fetcher.load;
  });

  const metaKey = useMemo(
    () => policyListMetaKey(searchParams),
    [searchParams],
  );

  useEffect(() => {
    loadRef.current(buildPolicyListMetaUrl(new URLSearchParams(metaKey)));
  }, [metaKey]);

  const countsPending =
    fetcher.state === "loading" ||
    (fetcher.state === "idle" && fetcher.data == null);

  return {
    meta: fetcher.data,
    countsPending,
    statusCounts: fetcher.data?.statusCounts,
    coverCounts: fetcher.data?.coverCounts,
    categoryCounts: fetcher.data?.categoryCounts,
    inceptionPresetCounts: fetcher.data?.inceptionPresetCounts,
    expiryPresetCounts: fetcher.data?.expiryPresetCounts,
    allCount: fetcher.data?.allCount ?? null,
  };
}
