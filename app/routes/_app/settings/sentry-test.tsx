import { useState } from "react";

import { PageHeader } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { getAppEnvironment, getAppVersion } from "~/lib/app-version";
import { requireSuperAdminPage } from "~/lib/auth/authorize.server";
import { requireAuth } from "~/lib/auth/session/server.server";
import { pageTitle } from "~/lib/brand";
import { trackClientUsage } from "~/lib/observability/metrics.client";
import { trackUsage } from "~/lib/observability/metrics.server";
import { cn } from "~/lib/utils";

import type { Route } from "./+types/sentry-test";

export function meta() {
  return [{ title: pageTitle("Sentry test") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  requireSuperAdminPage(user);

  const url = new URL(request.url);
  if (url.searchParams.get("throw") === "1") {
    throw new Error("Sentry UAT smoke test (server)");
  }
  if (url.searchParams.get("metric") === "1") {
    trackUsage("sentry.smoke_metric", { surface: "server" });
  }

  return {
    environment: getAppEnvironment(getAppVersion()),
    version: getAppVersion(),
    metricSent: url.searchParams.get("metric") === "1",
  };
}

export default function SentryTestRoute({ loaderData }: Route.ComponentProps) {
  const [boom, setBoom] = useState(false);
  const [metricNote, setMetricNote] = useState(
    loaderData.metricSent
      ? "Server metric sentry.smoke_metric sent — check Sentry → Metrics."
      : "",
  );
  if (boom) {
    throw new Error("Sentry UAT smoke test (client)");
  }

  return (
    <div>
      <PageHeader
        title="Sentry test"
        description="Super-admin only. Trigger errors, Replay, or a usage metric smoke test."
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Sentry test" },
        ]}
      />
      <div className="flex max-w-lg flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Release <code className="text-foreground">{loaderData.version}</code>{" "}
          · env{" "}
          <code className="text-foreground">{loaderData.environment}</code>
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/settings/sentry-test?throw=1"
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            Throw server error
          </a>
          <Button type="button" variant="outline" onClick={() => setBoom(true)}>
            Throw client error
          </Button>
          <a
            href="/settings/sentry-test?metric=1"
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Emit server metric
          </a>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              trackClientUsage("sentry.smoke_metric", { surface: "client" });
              setMetricNote(
                "Client metric sentry.smoke_metric sent — check Sentry → Metrics.",
              );
            }}
          >
            Emit client metric
          </Button>
        </div>
        {metricNote ? (
          <p className="text-sm text-muted-foreground">{metricNote}</p>
        ) : null}
      </div>
    </div>
  );
}
