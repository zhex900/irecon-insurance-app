import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFetcher } from "react-router";

import { useHydrated } from "~/hooks/network";
import {
  carWordingSessionCacheKey,
  getReferenceSessionCacheGeneration,
  subscribeReferenceSessionCacheInvalidation,
} from "~/lib/client/reference-session-cache";
import type { CarWording } from "~/lib/db/types";

function readCachedCarWording(): CarWording[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(carWordingSessionCacheKey());
    if (!raw) return null;
    return JSON.parse(raw) as CarWording[];
  } catch {
    return null;
  }
}

/** Claims wording catalogue — loaded when the Claims section is opened. */
export function useCarWording(enabled: boolean) {
  const hydrated = useHydrated();
  const fetcher = useFetcher<CarWording[]>();
  const loadRef = useRef(fetcher.load);
  const cacheGeneration = useSyncExternalStore(
    subscribeReferenceSessionCacheInvalidation.bind(null, "car-wording"),
    () => getReferenceSessionCacheGeneration("car-wording"),
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

  const cached = hydrated && enabled ? readCachedCarWording() : null;
  const fetched =
    fetcher.state === "idle" &&
    fetcher.data &&
    loadedGeneration === cacheGeneration
      ? fetcher.data
      : null;
  const carWording = cached ?? fetched ?? [];
  const pending = enabled && carWording.length === 0 && fetcher.state === "loading";

  useEffect(() => {
    if (!enabled || !hydrated || cached || fetcher.state !== "idle") return;
    loadRef.current("/api/car-wording");
  }, [enabled, hydrated, cached, fetcher.state, cacheGeneration]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    try {
      sessionStorage.setItem(
        carWordingSessionCacheKey(),
        JSON.stringify(fetcher.data),
      );
    } catch {
      // Private browsing / quota — ignore.
    }
  }, [fetcher.data, fetcher.state]);

  return { carWording, pending };
}
