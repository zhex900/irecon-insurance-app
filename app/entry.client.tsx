import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import * as Sentry from "@sentry/react-router/cloudflare";
import { getAppEnvironment, getAppVersion } from "~/lib/app-version";

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
const release = getAppVersion();
const environment = getAppEnvironment(release);
const isProd = environment === "prod";

if (dsn) {
  Sentry.init({
    dsn,
    enableMetrics: true,
    enableLogs: true,
    environment,
    release,
    sendDefaultPii: false,
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
