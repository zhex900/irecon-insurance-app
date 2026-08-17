import * as Sentry from "@sentry/cloudflare";
import { createRequestHandler, RouterContextProvider } from "react-router";

import {
  cloudflareContext,
  type CloudflareEnv,
} from "../app/lib/cloudflare.server";
import { withRequestDb } from "../app/lib/db/client";
import { logger } from "../app/lib/observability/logger.server";
import {
  resolveRequestId,
  takePendingSetCookies,
  withRequestContext,
} from "../app/lib/observability/request-context.server";
import { sentryOptionsFromEnv } from "../app/lib/observability/sentry.server";

declare global {
  interface Env extends CloudflareEnv {}
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

function applyDatabaseEnv(env: Env) {
  const hyperdrive = env.HYPERDRIVE;
  if (hyperdrive?.connectionString) {
    process.env.DATABASE_URL = hyperdrive.connectionString;
  } else if (env.DATABASE_URL) {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }
  if (env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL;
  if (env.SUPABASE_ANON_KEY)
    process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (env.APP_URL) process.env.APP_URL = env.APP_URL;
  if (env.RESEND_API_KEY) process.env.RESEND_API_KEY = env.RESEND_API_KEY;
  if (env.EMAIL_FROM) process.env.EMAIL_FROM = env.EMAIL_FROM;
  if (env.EMAIL_REPLY_TO) process.env.EMAIL_REPLY_TO = env.EMAIL_REPLY_TO;
  if (env.SENTRY_DSN) process.env.SENTRY_DSN = env.SENTRY_DSN;
  if (env.TURNSTILE_SECRET_KEY) {
    process.env.TURNSTILE_SECRET_KEY = env.TURNSTILE_SECRET_KEY;
  }
  if (env.SESSION_INACTIVITY_TIMEOUT_MINUTES != null) {
    process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES =
      env.SESSION_INACTIVITY_TIMEOUT_MINUTES;
  }
  if (env.SESSION_ABSOLUTE_TIMEOUT_HOURS != null) {
    process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS =
      env.SESSION_ABSOLUTE_TIMEOUT_HOURS;
  }
}

const handler = {
  async fetch(request: Request, env: Env, ctx: unknown) {
    applyDatabaseEnv(env);

    const requestId = resolveRequestId(request);
    const route = new URL(request.url).pathname;
    const started = Date.now();

    Sentry.setTag("requestId", requestId);
    Sentry.setTag("route", route);

    return withRequestContext({ requestId, route }, async () => {
      try {
        const response = await withRequestDb(async () => {
          const context = new RouterContextProvider();
          context.set(cloudflareContext, { env, ctx });
          return requestHandler(request, context);
        });

        const headers = new Headers(response.headers);
        headers.set("x-request-id", requestId);
        for (const setCookie of takePendingSetCookies()) {
          headers.append("Set-Cookie", setCookie);
        }

        const durationMs = Date.now() - started;

        logger.info("request.complete", {
          status: response.status,
          durationMs,
          method: request.method,
        });

        if (durationMs >= 8_000) {
          logger.error("request.slow", {
            durationMs,
            method: request.method,
            status: response.status,
            level: "error",
          });
        } else if (durationMs >= 2_000) {
          logger.warn("request.slow", {
            durationMs,
            method: request.method,
            status: response.status,
            level: "warn",
          });
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        logger.error("request.failed", {
          durationMs: Date.now() - started,
          method: request.method,
          error:
            error instanceof Error ? error.message : "unknown_request_error",
        });
        Sentry.captureException(error);
        throw error;
      }
    });
  },
};

export default Sentry.withSentry(
  (env: Env) => sentryOptionsFromEnv(env),
  handler,
);

export { cloudflareContext };
