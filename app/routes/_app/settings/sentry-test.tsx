import { useState } from "react";
import { PageHeader } from "~/components/layout/app-layout";
import { Button, buttonVariants } from "~/components/ui/button";
import { getAppEnvironment, getAppVersion } from "~/lib/app-version";
import { isSuperAdmin } from "~/lib/auth/roles";
import { requireAuth } from "~/lib/auth/session.server";
import { pageTitle } from "~/lib/brand";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/sentry-test";

export function meta() {
  return [{ title: pageTitle("Sentry test") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  if (!isSuperAdmin(user)) {
    throw new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("throw") === "1") {
    throw new Error("Sentry staging smoke test (server)");
  }

  return {
    environment: getAppEnvironment(getAppVersion()),
    version: getAppVersion(),
  };
}

export default function SentryTestRoute({ loaderData }: Route.ComponentProps) {
  const [boom, setBoom] = useState(false);
  if (boom) {
    throw new Error("Sentry staging smoke test (client)");
  }

  return (
    <div>
      <PageHeader
        title="Sentry test"
        description="Super-admin only. Trigger a server or client error to verify Issues + Replay."
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
        </div>
      </div>
    </div>
  );
}
