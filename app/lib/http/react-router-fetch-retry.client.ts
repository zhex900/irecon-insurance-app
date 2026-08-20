const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [100, 300] as const;
const VISIBILITY_WAIT_MS = 30_000;

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function resolveRequestMethod(
  input: RequestInfo | URL,
  init?: RequestInit,
): string {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function isSameOriginRequest(input: RequestInfo | URL): boolean {
  try {
    const url = new URL(resolveRequestUrl(input), window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

/** React Router single-fetch loader requests (e.g. `/login.data`). */
function isReactRouterDataRequest(input: RequestInfo | URL): boolean {
  try {
    const { pathname } = new URL(
      resolveRequestUrl(input),
      window.location.origin,
    );
    return pathname.endsWith(".data");
  } catch {
    return false;
  }
}

function isTransientFetchError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("network request failed")
  );
}

function isRetryableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Wait for a background tab to become visible before retrying navigation fetches. */
async function waitForVisibleTab() {
  if (document.visibilityState === "visible") return;

  await new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(resolve, VISIBILITY_WAIT_MS);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibility);
      resolve();
    };
    document.addEventListener("visibilitychange", onVisibility);
  });
}

function shouldRetryRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): boolean {
  if (!isSameOriginRequest(input)) return false;
  if (!isReactRouterDataRequest(input)) return false;
  const method = resolveRequestMethod(input, init);
  return method === "GET" || method === "HEAD";
}

/**
 * Retry React Router loader fetches (`.data` GET/HEAD only) when the browser
 * drops the connection — e.g. background-tab throttling. Does not wrap POST
 * actions or arbitrary `/api/*` calls.
 */
export function installReactRouterFetchRetry() {
  if (typeof window === "undefined" || window.__ireconFetchRetryInstalled) {
    return;
  }
  window.__ireconFetchRetryInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    if (!shouldRetryRequest(input, init)) {
      return originalFetch(input, init);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await originalFetch(input, init);
        if (attempt < MAX_ATTEMPTS - 1 && isRetryableStatus(response.status)) {
          await sleep(RETRY_DELAYS_MS[attempt] ?? 300);
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt >= MAX_ATTEMPTS - 1 || !isTransientFetchError(error)) {
          throw error;
        }

        await waitForVisibleTab();
        await sleep(RETRY_DELAYS_MS[attempt] ?? 300);
      }
    }

    throw lastError;
  };
}

declare global {
  interface Window {
    __ireconFetchRetryInstalled?: boolean;
  }
}
