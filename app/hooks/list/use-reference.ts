import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import { useHydrated } from "~/hooks/network";
import { getAppVersion } from "~/lib/app-version";
import type { ListReferenceData } from "~/lib/services/reference.service";

const cacheKey = () => `list-reference:${getAppVersion()}`;

function readCachedReference(): ListReferenceData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey());
    if (!raw) return null;
    return JSON.parse(raw) as ListReferenceData;
  } catch {
    return null;
  }
}

/** Load live AM + AR for list filters via `/api/reference/list` (session-cached). */
export function useListReference() {
  const hydrated = useHydrated();
  const fetcher = useFetcher<ListReferenceData>();
  const loadRef = useRef(fetcher.load);

  useEffect(() => {
    loadRef.current = fetcher.load;
  });

  // Defer sessionStorage reads until after hydration (matches SSR static reference).
  const cached = hydrated ? readCachedReference() : null;
  const reference = cached ?? fetcher.data ?? null;
  const pending = reference == null && fetcher.state === "loading";

  useEffect(() => {
    if (!hydrated || cached || fetcher.data || fetcher.state !== "idle") return;
    loadRef.current("/api/reference/list");
  }, [hydrated, cached, fetcher.data, fetcher.state]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    try {
      sessionStorage.setItem(cacheKey(), JSON.stringify(fetcher.data));
    } catch {
      // Private browsing / quota — ignore.
    }
  }, [fetcher.data, fetcher.state]);

  return { reference, pending };
}
