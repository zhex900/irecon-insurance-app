import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { NewPolicyClientDialog } from "~/components/policies/new-policy-client-dialog";
import { requireAuth } from "~/lib/auth/session.server";
import { getDashboardStats } from "~/lib/services/clients/dashboard.service";
import { toBrokerSession } from "~/lib/services/broker-session";
import { formatNumber } from "~/lib/utils";
import { POLICY_STATUS } from "~/lib/zod/policy-car";
import type { Route } from "./+types/dashboard";

export function meta() {
  return [{ title: "Dashboard | BrokerSure" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  const stats = await getDashboardStats();
  return {
    ...stats,
    broker: toBrokerSession(user),
  };
}

export default function DashboardRoute({ loaderData }: Route.ComponentProps) {
  const firstName = loaderData.broker.fullName.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Good day, {firstName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s your operational overview for {today}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/clients/new">
            <Button variant="outline">+ New Client</Button>
          </Link>
          <NewPolicyClientDialog />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total Clients"
          value={loaderData.clients}
          hint="All records"
          to="/clients"
        />
        <StatCard
          label="Active Policies"
          value={loaderData.taken}
          hint="Taken status"
          to={`/policies?status=${POLICY_STATUS.Taken}`}
        />
        <StatCard
          label="Pending"
          value={loaderData.pending}
          hint="Needs action"
          to={`/policies?status=${POLICY_STATUS.Pending}`}
        />
        <StatCard
          label="Not Taken"
          value={loaderData.notTaken}
          hint="Declined / not bound"
          to={`/policies?status=${POLICY_STATUS.NotTaken}`}
        />
        <StatCard
          label="All Policies"
          value={loaderData.policies}
          hint="Portfolio total"
          to="/policies"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Link className="text-primary hover:underline" to="/clients">
              Clients directory →
            </Link>
            <Link className="text-primary hover:underline" to="/policies">
              All policies →
            </Link>
            <Link
              className="text-primary hover:underline"
              to={`/policies?status=${POLICY_STATUS.Pending}`}
            >
              Pending policies →
            </Link>
            <Link
              className="text-primary hover:underline"
              to={`/policies?status=${POLICY_STATUS.NotTaken}`}
            >
              Not taken policies →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portfolio snapshot</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              {formatNumber(loaderData.taken)} taken ·{" "}
              {formatNumber(loaderData.pending)} pending ·{" "}
              {formatNumber(loaderData.notTaken)} not taken ·{" "}
              {formatNumber(loaderData.clients)} clients on file.
            </p>
            <p className="mt-2 text-muted-foreground">
              Charts and activity feeds come in a later pass.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  to,
}: {
  label: string;
  value: number;
  hint: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="block rounded-xl transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-foreground tabular-nums">
            {formatNumber(value)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
