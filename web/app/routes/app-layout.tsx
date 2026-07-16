import { AppLayout } from "~/components/layout/app-layout";
import { requireAuth } from "~/lib/auth/session.server";
import {
  getBrokerSession,
  getReferenceData,
  listPolicySummaries,
} from "~/lib/services/store";
import type { Route } from "./+types/app-layout";

export async function loader({ request }: Route.LoaderArgs) {
  requireAuth(request);
  const reference = getReferenceData();
  return {
    broker: getBrokerSession(),
    policies: await listPolicySummaries(),
    policyStatuses: reference.policyStatuses,
  };
}

export default function AppLayoutRoute({ loaderData }: Route.ComponentProps) {
  return (
    <AppLayout
      broker={loaderData.broker}
      policies={loaderData.policies}
      policyStatuses={loaderData.policyStatuses}
    />
  );
}
