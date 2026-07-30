import {
  type ShouldRevalidateFunctionArgs,
  useRouteLoaderData,
} from "react-router";
import { AppErrorPage } from "~/components/app-error-page";
import { AppLayout } from "~/components/layout/app-layout";
import { requireAuth } from "~/lib/auth/session.server";
import { toBrokerSession } from "~/lib/services/broker-session";
import { getSideNavData } from "~/lib/services/navigation/side-nav.service";
import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const [broker, sideNav] = await Promise.all([
    Promise.resolve(toBrokerSession(user)),
    getSideNavData(user),
  ]);
  return {
    broker,
    sideNav,
  };
}

export function shouldRevalidate({
  formData,
  actionResult,
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
  // Keep broker + side nav stable across child route navigations.
  return false;
}

export default function AppLayoutRoute({ loaderData }: Route.ComponentProps) {
  return <AppLayout broker={loaderData.broker} sideNav={loaderData.sideNav} />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // Prefer keeping the shell (side nav) when layout data is still available.
  const data = useRouteLoaderData<typeof loader>("routes/_app/layout");
  if (data?.broker && data?.sideNav) {
    return (
      <AppLayout
        broker={data.broker}
        sideNav={data.sideNav}
        content={<AppErrorPage error={error} />}
      />
    );
  }
  return <AppErrorPage error={error} />;
}
