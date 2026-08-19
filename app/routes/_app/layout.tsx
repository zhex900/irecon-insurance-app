import {
  type ShouldRevalidateFunctionArgs,
  useRouteLoaderData,
} from "react-router";

import { AppLayout } from "~/components/layout/app-layout";
import { RootErrorBoundary } from "~/components/root-error-boundary";
import { toBrokerSession } from "~/lib/auth/session";
import { requireAuth } from "~/lib/auth/session/server.server";
import { getSessionTimeoutClientState } from "~/lib/auth/session/timeout.server";
import { getThemeWithFallback } from "~/lib/cookies";
import { updateRequestContext } from "~/lib/observability/request-context.server";
import { setSentryUser } from "~/lib/observability/sentry.server";
import { getSideNavData } from "~/lib/services/navigation/side-nav.service";
import {
  resolveNavSectionsExpanded,
  resolveShellNavState,
} from "~/lib/services/navigation/sidebar-state";

import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  updateRequestContext({ userId: user.userId });
  setSentryUser({ userId: user.userId, email: user.email });
  const shellNav = resolveShellNavState(request);
  const navSectionsExpanded = resolveNavSectionsExpanded(
    request,
    new URL(request.url).pathname,
  );
  const [broker, sideNav] = await Promise.all([
    Promise.resolve(toBrokerSession(user)),
    getSideNavData(user),
  ]);
  return {
    broker,
    sideNav,
    sidebarOpen: shellNav.sidebarOpen,
    recentsOpen: shellNav.recentsOpen,
    navSectionsExpanded,
    sessionTimeout: getSessionTimeoutClientState(request),
    theme: getThemeWithFallback(request),
  };
}

export function shouldRevalidate({
  formData,
  actionResult,
  formAction,
}: ShouldRevalidateFunctionArgs) {
  // Child policy draft saves should not refetch the shell.
  if (formData?.get("intent") === "draft") return false;
  if (
    actionResult &&
    typeof actionResult === "object" &&
    "draft" in actionResult &&
    (actionResult as { draft?: boolean }).draft
  ) {
    return false;
  }
  // Profile saves update the header avatar / name.
  if (
    formAction?.includes("/profile") ||
    (actionResult &&
      typeof actionResult === "object" &&
      "intent" in actionResult &&
      (actionResult as { intent?: string }).intent === "profile")
  ) {
    return true;
  }
  // Keep broker + side nav stable across child route navigations.
  return false;
}

export default function AppLayoutRoute({ loaderData }: Route.ComponentProps) {
  return (
    <AppLayout
      broker={loaderData.broker}
      sideNav={loaderData.sideNav}
      sidebarOpen={loaderData.sidebarOpen}
      recentsOpen={loaderData.recentsOpen}
      navSectionsExpanded={loaderData.navSectionsExpanded}
      sessionTimeout={loaderData.sessionTimeout}
      theme={loaderData.theme}
    />
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Prefer keeping the shell (side nav) when layout data is still available.
  const data = useRouteLoaderData<typeof loader>("routes/_app/layout");
  if (data?.broker && data?.sideNav) {
    return (
      <AppLayout
        broker={data.broker}
        sideNav={data.sideNav}
        sidebarOpen={data.sidebarOpen}
        recentsOpen={data.recentsOpen}
        navSectionsExpanded={data.navSectionsExpanded}
        sessionTimeout={data.sessionTimeout}
        theme={data.theme}
        content={<RootErrorBoundary error={error} />}
      />
    );
  }
  return <RootErrorBoundary error={error} />;
}
