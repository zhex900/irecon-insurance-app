import { useEffect, useState } from "react";

/**
 * Optional client fetch that never throws — failures stay local (no React Router onError).
 * Use for secondary UI data (badge counts, reference lookups) where the page works without it.
 */
export function useOptionalApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [prevUrl, setPrevUrl] = useState<string | null>(url);
  const [pending, setPending] = useState(url != null);

  if (url !== prevUrl) {
    setPrevUrl(url);
    setPending(url != null);
    setData(null);
  }

  useEffect(() => {
    if (!url) return;

    let cancelled = false;

    void fetch(url, { credentials: "same-origin" })
      .then(async (response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((json: T | null) => {
        if (cancelled) return;
        setData(json);
        setPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, pending };
}
