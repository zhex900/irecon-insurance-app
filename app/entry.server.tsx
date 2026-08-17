import * as Sentry from "@sentry/react-router/cloudflare";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type {
  EntryContext,
  HandleErrorFunction,
  RouterContextProvider,
} from "react-router";
import { ServerRouter } from "react-router";

import { formatDbErrorChain } from "~/lib/db/query-gate";
import { logger } from "~/lib/observability/logger.server";
import { captureServerException } from "~/lib/observability/sentry.server";

export const streamTimeout = 5_000;

async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider,
) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }

  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  const stream = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      signal: AbortSignal.timeout(streamTimeout + 1000),
      onError(error: unknown) {
        responseStatusCode = 500;
        if (shellRendered) {
          logger.error("ssr.stream_error", {
            error: error instanceof Error ? error.message : "ssr_error",
          });
          captureServerException(error);
        }
      },
    },
  );
  shellRendered = true;

  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await stream.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(Sentry.injectTraceMetaTags(stream), {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

export const handleError: HandleErrorFunction = (error, { request }) => {
  if (request.signal.aborted) return;
  logger.error("route.handle_error", {
    error: formatDbErrorChain(error),
  });
  captureServerException(error);
};

export default Sentry.wrapSentryHandleRequest(handleRequest);
