import { useEffect } from "react";
import { useSearchParams } from "react-router";

import { useUrlFilterDraft } from "~/hooks/utilities";

const DEFAULT_DELAY_MS = 250;

/**
 * Search draft debounced to the `q` URL param.
 * Preserves other search params; resets `page` when the query changes.
 */
export function useDebouncedSearchQuery(
  committedQuery: string,
  options?: { delayMs?: number },
) {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    draft: search,
    setDraft: setSearch,
    commitDraft,
  } = useUrlFilterDraft(committedQuery);

  useEffect(() => {
    const next = search.trim();
    const current = committedQuery.trim();
    if (next === current) return;
    const timer = window.setTimeout(() => {
      commitDraft(next);
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
  }, [search, committedQuery, delayMs, setSearchParams, commitDraft]);

  function clearSearch() {
    commitDraft("");
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
