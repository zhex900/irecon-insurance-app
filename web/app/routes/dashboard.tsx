import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PageHeader } from "~/components/layout/app-layout";
import { getDashboardStats } from "~/lib/services/store";
import type { Route } from "./+types/dashboard";

export function meta() {
  return [{ title: "Dashboard | CAR Broker Portal" }];
}

export async function loader() {
  return await getDashboardStats();
}

export default function DashboardRoute({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Broker overview for CAR quotes and clients."
        action={
          <Link
            to="/clients"
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            View clients
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clients" value={loaderData.clients} />
        <StatCard label="Quotes" value={loaderData.quotes} />
        <StatCard label="Pending" value={loaderData.pending} />
        <StatCard label="Taken" value={loaderData.taken} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}
