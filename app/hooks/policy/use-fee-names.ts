import { useReferenceSessionFetch } from "~/hooks/network/use-reference-session-fetch";
import { policyFeeNamesSessionCacheKey } from "~/lib/client/reference-session-cache";
import type { ReferenceData } from "~/lib/db/types";

/** Live broker fee lines for premium breakdown (session-cached per inception date). */
export function usePolicyFeeNames(feeAsOf: string, enabled = true) {
  const asOf = feeAsOf.slice(0, 10) || new Date().toISOString().slice(0, 10);

  const { data: feeNames, pending } = useReferenceSessionFetch<
    ReferenceData["feeNames"] | null
  >({
    kind: "policy-fee-names",
    cacheKey: policyFeeNamesSessionCacheKey(asOf),
    url: `/api/reference/fee-names?asOf=${encodeURIComponent(asOf)}`,
    enabled,
    fallback: null,
    isEmpty: (value) => value == null,
  });

  return { feeNames, pending };
}
