import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { buildApiSearchUrl } from "~/lib/search/api-search";

export type ApiSearchParams = Record<string, string | number | undefined>;

const EMPTY_SEARCH_PARAMS: ApiSearchParams = {};

/**
 * Debounced `/api/search` requests via `useFetcher`.
 * Tracks which query the current payload belongs to (`settledQuery`).
 */
export function useApiSearch<T>(options: {
  enabled: boolean;
  query: string;
  debounceMs?: number;
  searchParams?: ApiSearchParams;
}) {
  const { enabled, query, debounceMs = 250, searchParams } = options;
  const fetcher = useFetcher<T>();
  const loadSearchRef = useRef(fetcher.load);
  useEffect(() => {
    loadSearchRef.current = fetcher.load;
  });
  const trimmed = query.trim();
  const active = enabled && trimmed.length > 0;
  const resolvedParams = useMemo(
    () => searchParams ?? EMPTY_SEARCH_PARAMS,
    [searchParams],
  );
  const paramsKey = JSON.stringify(resolvedParams);

  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState<string | null>(null);
  const pendingQueryRef = useRef<string | null>(null);
  const searchParamsRef = useRef(resolvedParams);
  useEffect(() => {
    searchParamsRef.current = resolvedParams;
  }, [resolvedParams]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(
      () => setDebouncedQuery(trimmed),
      debounceMs,
    );
    return () => window.clearTimeout(timer);
  }, [active, trimmed, debounceMs]);

  useEffect(() => {
    if (!active || !debouncedQuery) return;

    pendingQueryRef.current = debouncedQuery;
    loadSearchRef.current(
      buildApiSearchUrl(debouncedQuery, searchParamsRef.current),
    );
    // `fetcher` is intentionally omitted — it changes every load and retriggers forever.
  }, [active, debouncedQuery, paramsKey]);

  useEffect(() => {
    if (!active || fetcher.state !== "idle") return;
    const pending = pendingQueryRef.current;
    if (!pending) return;
    setSettledQuery(pending);
  }, [active, fetcher.state, fetcher.data]);

  const isDebouncing = active && debouncedQuery !== trimmed;
  const isLoading = fetcher.state === "loading";
  const isSearching =
    active &&
    (isDebouncing ||
      isLoading ||
      settledQuery !== trimmed ||
      (Boolean(debouncedQuery) && settledQuery !== debouncedQuery));
  const isSettled = active && settledQuery === trimmed;
  const hasError = isSettled && fetcher.data == null;

  function reset() {
    setDebouncedQuery("");
    setSettledQuery(null);
    pendingQueryRef.current = null;
  }

  return {
    trimmedQuery: trimmed,
    active,
    data: isSettled ? (fetcher.data ?? null) : null,
    isSearching,
    isSettled,
    hasError,
    reset,
  };
}
