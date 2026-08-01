import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

const DEFAULT_DELAY_MS = 250;

/**
 * Local search draft synced to the `q` URL param (debounced).
 * Preserves other search params; resets `page` when the query changes.
 */
export function useDebouncedSearchQuery(
  committedQuery: string,
  options?: { delayMs?: number },
) {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(committedQuery);
  const lastCommittedRef = useRef(committedQuery);

  useEffect(() => {
    if (lastCommittedRef.current === committedQuery) return;
    lastCommittedRef.current = committedQuery;
    setSearch(committedQuery);
  }, [committedQuery]);

  useEffect(() => {
    const next = search.trim();
    const current = committedQuery.trim();
    if (next === current) return;
    const timer = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.delete("page");
          if (next) params.set("q", next);
          else params.delete("q");
          return params;
        },
        { replace: true },
      );
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [search, committedQuery, delayMs, setSearchParams]);

  function clearSearch() {
    setSearch("");
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("page");
        params.delete("q");
        return params;
      },
      { replace: true },
    );
  }

  return {
    search,
    setSearch,
    clearSearch,
    searchQuery: committedQuery.trim(),
    searchParams,
    setSearchParams,
  };
}
