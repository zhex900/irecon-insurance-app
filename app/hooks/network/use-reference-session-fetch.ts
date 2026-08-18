import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFetcher } from "react-router";

import { useHydrated } from "~/hooks/network/use-hydrated";
import {
  getReferenceSessionCacheGeneration,
  type ReferenceSessionCacheKind,
  subscribeReferenceSessionCacheInvalidation,
} from "~/lib/client/reference-session-cache";

function readSessionCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeSessionCache(key: string, data: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Private browsing / quota — ignore.
  }
}

/** Session-cached reference fetch via `useFetcher` + generation invalidation. */
export function useReferenceSessionFetch<T>(options: {
  kind: ReferenceSessionCacheKind;
  cacheKey: string;
  url: string;
  enabled?: boolean;
  fallback: T;
  isEmpty?: (value: T) => boolean;
}) {
  const {
    kind,
    cacheKey,
    url,
    enabled = true,
    fallback,
    isEmpty = (value: T) =>
      value === null || (Array.isArray(value) && value.length === 0),
  } = options;

  const hydrated = useHydrated();
  const fetcher = useFetcher<T>();
  const loadRef = useRef(fetcher.load);
  const cacheGeneration = useSyncExternalStore(
    subscribeReferenceSessionCacheInvalidation.bind(null, kind),
    () => getReferenceSessionCacheGeneration(kind),
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

  const cached =
    hydrated && enabled ? readSessionCache<T>(cacheKey) : null;
  const fetched =
    fetcher.state === "idle" &&
    fetcher.data != null &&
    loadedGeneration === cacheGeneration
      ? (fetcher.data as T)
      : null;
  const data: T = cached ?? fetched ?? fallback;
  const pending = enabled && isEmpty(data) && fetcher.state === "loading";

  useEffect(() => {
    if (!enabled || !hydrated || cached || fetcher.state !== "idle") return;
    loadRef.current(url);
  }, [enabled, hydrated, cached, fetcher.state, url, cacheGeneration]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    writeSessionCache(cacheKey, fetcher.data);
  }, [fetcher.data, fetcher.state, cacheKey]);

  return { data, pending };
}
