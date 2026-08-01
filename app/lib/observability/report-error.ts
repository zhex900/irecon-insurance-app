import { isRouteErrorResponse } from "react-router";

const reported = new WeakSet<object>();

function shouldReport(error: unknown): boolean {
  if (isRouteErrorResponse(error)) {
    // Skip expected client / auth redirects and not-found.
    if (error.status < 500) return false;
  }
  return true;
}

/**
 * Report a route/UI error to Sentry once (client-side).
 * Server errors are captured via entry.server `handleError` + Worker SDK.
 */
export function reportClientRouteError(error: unknown): void {
  if (typeof document === "undefined") return;
  if (!shouldReport(error)) return;

  const key = typeof error === "object" && error !== null ? error : null;
  if (key) {
    if (reported.has(key)) return;
    reported.add(key);
  }

  void import("@sentry/react-router/cloudflare")
    .then((Sentry) => {
      Sentry.captureException(error);
    })
    .catch(() => {
      // Sentry optional / failed to load — ignore.
    });
}
