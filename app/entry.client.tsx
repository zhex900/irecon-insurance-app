import * as Sentry from "@sentry/react-router/cloudflare";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import {
  getAppEnvironment,
  getAppRelease,
  getAppVersion,
} from "~/lib/app-version";
import { installReactRouterFetchRetry } from "~/lib/http/react-router-fetch-retry.client";

installReactRouterFetchRetry();

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
const release = getAppRelease();
const environment = getAppEnvironment(getAppVersion());
const isProd = environment === "prod";

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release,
    integrations: [
      Sentry.reactRouterTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        maskAllInputs: true,
      }),
    ],
    tracesSampleRate: isProd ? 0.1 : 1,
    replaysSessionSampleRate: isProd ? 0.1 : 1,
    replaysOnErrorSampleRate: 1,
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      {dsn ? (
        <HydratedRouter onError={Sentry.sentryOnError} />
      ) : (
        <HydratedRouter />
      )}
    </StrictMode>,
  );
});
