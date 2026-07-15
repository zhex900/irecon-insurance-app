import { redirect } from "react-router";
import { isAuthenticated } from "~/lib/auth/session.server";
import { listPolicySummaries } from "~/lib/services/store";
import type { Route } from "./+types/_index";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isAuthenticated(request)) {
    return redirect("/login");
  }

  const policies = await listPolicySummaries();
  if (policies.length > 0) {
    return redirect(`/quotes/${policies[0].policyId}`);
  }

  return redirect("/dashboard");
}
