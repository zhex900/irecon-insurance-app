import { useMemo } from "react";

import { useOptionalApi } from "~/hooks/network/use-optional-api";
import {
  buildPolicyListSecondaryUrl,
  policyListSecondaryKey,
} from "~/lib/search/policy-list-secondary-api";
import type { PolicyListSecondaryResponse } from "~/lib/services/policies/list.service";
import type { ListReferenceData } from "~/lib/services/reference.service";

/** Load filter badge counts + live AM/AR in one `/api/policies/list-secondary` request. */
export function usePolicyListSecondary(searchParams: URLSearchParams) {
  const secondaryKey = useMemo(
    () => policyListSecondaryKey(searchParams),
    [searchParams],
  );
  const url = useMemo(
    () => buildPolicyListSecondaryUrl(new URLSearchParams(secondaryKey)),
    [secondaryKey],
  );

  const { data, pending } = useOptionalApi<PolicyListSecondaryResponse>(url);

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
