import { type ShouldRevalidateFunctionArgs } from "react-router";
import { AppErrorPage } from "~/components/app-error-page";
import { AppLayout } from "~/components/layout/app-layout";
import { requireAuth } from "~/lib/auth/session.server";
import { toBrokerSession } from "~/lib/services/broker-session";
import type { Route } from "./+types/layout";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  return {
    broker: toBrokerSession(user),
  };
}

export function shouldRevalidate({
  formData,
  actionResult,
  defaultShouldRevalidate,
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
  return defaultShouldRevalidate;
}

export default function AppLayoutRoute({ loaderData }: Route.ComponentProps) {
  return <AppLayout broker={loaderData.broker} />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <AppErrorPage error={error} />;
}
