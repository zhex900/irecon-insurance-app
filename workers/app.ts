import * as Sentry from "@sentry/cloudflare";
import { createRequestHandler, RouterContextProvider } from "react-router";

import {
  cloudflareContext,
  type CloudflareEnv,
} from "../app/lib/cloudflare.server";
import { applyWorkerRuntimeEnv } from "../app/lib/cloudflare/apply-worker-env.server";
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
  applyWorkerRuntimeEnv(env, { dev: import.meta.env.DEV });
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
