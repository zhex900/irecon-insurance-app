import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

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
  const fetcher = useFetcher<ListReferenceData>();
  const loadRef = useRef(fetcher.load);
  useEffect(() => {
    loadRef.current = fetcher.load;
  });

  const [cached, setCached] = useState<ListReferenceData | null>(readCachedReference);

  useEffect(() => {
    if (cached) return;
    loadRef.current("/api/reference/list");
  }, [cached]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    try {
      sessionStorage.setItem(cacheKey(), JSON.stringify(fetcher.data));
    } catch {
      // Private browsing / quota — ignore.
    }
    setCached(fetcher.data);
  }, [fetcher.data, fetcher.state]);

  const reference = cached ?? fetcher.data ?? null;
  const pending = reference == null;

  return { reference, pending };
}
