import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFetcher } from "react-router";

import { useHydrated } from "~/hooks/network";
import {
  getReferenceSessionCacheGeneration,
  policyFeeNamesSessionCacheKey,
  subscribeReferenceSessionCacheInvalidation,
} from "~/lib/client/reference-session-cache";
import type { ReferenceData } from "~/lib/db/types";

function readCachedFeeNames(asOf: string): ReferenceData["feeNames"] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(policyFeeNamesSessionCacheKey(asOf));
    if (!raw) return null;
    return JSON.parse(raw) as ReferenceData["feeNames"];
  } catch {
    return null;
  }
}

/** Live broker fee lines for premium breakdown (session-cached per inception date). */
export function usePolicyFeeNames(feeAsOf: string, enabled = true) {
  const hydrated = useHydrated();
  const fetcher = useFetcher<ReferenceData["feeNames"]>();
  const loadRef = useRef(fetcher.load);
  const asOf = feeAsOf.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const cacheGeneration = useSyncExternalStore(
    subscribeReferenceSessionCacheInvalidation.bind(null, "policy-fee-names"),
    () => getReferenceSessionCacheGeneration("policy-fee-names"),
    () => 0,
  );
  const [loadedGeneration, setLoadedGeneration] = useState(cacheGeneration);
  const prevFetcherStateRef = useRef(fetcher.state);

  useEffect(() => {
    loadRef.current = fetcher.load;
  });

  useEffect(() => {
    const wasLoading = prevFetcherStateRef.current === "loading";
    prevFetcherStateRef.current = fetcher.state;
    if (wasLoading && fetcher.state === "idle" && fetcher.data) {
      setLoadedGeneration(cacheGeneration);
    }
  }, [fetcher.state, fetcher.data, cacheGeneration]);

  const cached = hydrated && enabled ? readCachedFeeNames(asOf) : null;
  const fetched =
    fetcher.state === "idle" &&
    fetcher.data &&
    loadedGeneration === cacheGeneration
      ? fetcher.data
      : null;
  const feeNames = cached ?? fetched ?? null;
  const pending = enabled && feeNames == null && fetcher.state === "loading";

  useEffect(() => {
    if (!enabled || !hydrated || cached || fetcher.state !== "idle") return;
    loadRef.current(`/api/reference/fee-names?asOf=${encodeURIComponent(asOf)}`);
  }, [enabled, hydrated, cached, fetcher.state, asOf, cacheGeneration]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    try {
      sessionStorage.setItem(
        policyFeeNamesSessionCacheKey(asOf),
        JSON.stringify(fetcher.data),
      );
    } catch {
      // Private browsing / quota — ignore.
    }
  }, [fetcher.data, fetcher.state, asOf]);

  return { feeNames, pending };
}
