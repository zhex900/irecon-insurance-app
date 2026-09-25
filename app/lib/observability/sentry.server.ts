/**
 * Server-only Sentry helpers (Worker / SSR). Do not import from client modules.
 */
import type { CloudflareOptions } from "@sentry/cloudflare";
import * as Sentry from "@sentry/cloudflare";

import {
  getAppEnvironment,
  getAppRelease,
  getAppVersion,
} from "~/lib/app-version";
import type { CloudflareEnv } from "~/lib/cloudflare.server";
import { getRequestContext } from "~/lib/observability/request-context.server";

function isInternalRouteError(value: unknown): value is {
  internal: true;
  status: number;
} {
  return (
    value != null &&
    typeof value === "object" &&
    "internal" in value &&
    value.internal === true &&
    "status" in value &&
    typeof value.status === "number" &&
    value.status < 500
  );
}

export function sentryOptionsFromEnv(
  env: CloudflareEnv,
): CloudflareOptions | undefined {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return undefined;

  const release = getAppRelease();
  const environment = getAppEnvironment(getAppVersion());

  return {
    dsn,
    environment,
    release,
    tracesSampleRate: environment === "prod" ? 0.1 : 1,
    beforeSend(event) {
      // Drop request bodies — may contain form PII / credentials.
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
          delete event.request.headers.Cookie;
          delete event.request.headers.Authorization;
        }
      }

      // Safety net: internal React Router 404/405 (e.g. bot probes to /api/gql).
      const serialized = event.extra?.__serialized__;
      if (isInternalRouteError(serialized)) {
        return null;
      }

      return event;
    },
  };
}

export function setSentryRequestTags(): void {
  const ctx = getRequestContext();
  if (!ctx) return;
  Sentry.setTag("requestId", ctx.requestId);
  if (ctx.route) Sentry.setTag("route", ctx.route);
  if (ctx.userId) Sentry.setTag("userId", ctx.userId);
}

export function setSentryUser(
  user: { userId: string; email: string } | null,
): void {
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.userId, email: user.email });
}

export function captureServerException(
  error: unknown,
  tags?: Record<string, string>,
): void {
  setSentryRequestTags();
  if (tags) {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(tags)) {
        scope.setTag(key, value);
      }
      Sentry.captureException(error);
    });
    return;
  }
  Sentry.captureException(error);
}

export { Sentry };
