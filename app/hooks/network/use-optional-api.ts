import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

/**
 * Secondary data via `useFetcher` that fails silently — optional UI (badge counts,
 * reference lookups) keeps working when the request fails or returns no data.
 *
 * Fetcher loader errors do not bubble to the route error boundary; we treat a
 * settled idle fetch with no data as unavailable rather than surfacing an error.
 */
export function useOptionalApi<T>(url: string | null) {
  const fetcher = useFetcher<T>();
  const loadRef = useRef(fetcher.load);
  const pendingUrlRef = useRef<string | null>(null);
  const prevFetcherStateRef = useRef(fetcher.state);
  const [settledUrl, setSettledUrl] = useState<string | null>(null);
  const [trackedUrl, setTrackedUrl] = useState<string | null>(url);

  useEffect(() => {
    loadRef.current = fetcher.load;
  });

  if (url !== trackedUrl) {
    setTrackedUrl(url);
    setSettledUrl(null);
  }

  useEffect(() => {
    pendingUrlRef.current = null;
  }, [url]);

  useEffect(() => {
    if (!url || fetcher.state !== "idle") return;
    if (settledUrl === url) return;
    pendingUrlRef.current = url;
    loadRef.current(url);
  }, [url, fetcher.state, settledUrl]);

  useEffect(() => {
    const wasLoading = prevFetcherStateRef.current === "loading";
    prevFetcherStateRef.current = fetcher.state;
    if (!wasLoading || fetcher.state !== "idle") return;
    const pending = pendingUrlRef.current;
    if (!pending) return;
    if (import.meta.env.DEV && fetcher.data === undefined) {
      console.warn(
        `[useOptionalApi] Request failed or returned no data: ${pending}`,
      );
    }
    setSettledUrl(pending);
    pendingUrlRef.current = null;
  }, [fetcher.state, fetcher.data]);

  const pending = url != null && settledUrl !== url;
  const data =
    url != null && settledUrl === url ? (fetcher.data ?? null) : null;

  return { data, pending };
}
