import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getBrowserOnline() {
  return navigator.onLine;
}

function getServerOnline() {
  return true;
}

/** One-shot same-origin probe — not polling; runs on mount and when `online` fires. */
async function verifyReachability(): Promise<boolean> {
  if (!navigator.onLine) return false;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("/favicon.ico", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/**
 * Event-driven network status (no polling).
 *
 * - `offline` / `online` window events via `useSyncExternalStore`
 * - Optional reachability check when the browser reports online (catches some
 *   “connected to Wi‑Fi but no internet” cases without a timer loop)
 */
export function useNetworkStatus() {
  const browserOnline = useSyncExternalStore(
    subscribeOnline,
    getBrowserOnline,
    getServerOnline,
  );
  const [reachable, setReachable] = useState<boolean | null>(null);

  const checkReachability = useCallback(async () => {
    setReachable(await verifyReachability());
  }, []);

  useEffect(() => {
    if (!browserOnline) {
      setReachable(false);
      return;
    }
    setReachable(null);
    void checkReachability();
  }, [browserOnline, checkReachability]);

  const isOffline = !browserOnline || reachable === false;

  return { isOffline, browserOnline };
}
