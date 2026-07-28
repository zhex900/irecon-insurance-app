import { Link } from "react-router";
import {
  FileBarChart2Icon,
  RefreshCwIcon,
  ArrowRightIcon,
  UsersIcon,
} from "lucide-react";
import { PageHeader } from "~/components/layout/app-layout";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function meta() {
  return [{ title: "Reports | BrokerSure" }];
}

const reports = [
  {
    to: "/reports/clients",
    title: "Client Report",
    description:
      "List clients with turnover limit and expiry for a date range. Clear dates to show all.",
    icon: UsersIcon,
  },
  {
    to: "/reports/car-policies",
    title: "CAR Policy Report",
    description:
      "Summarise CAR policies by status for a date period, then drill into detail and export CSV.",
    icon: FileBarChart2Icon,
  },
  {
    to: "/reports/car-renewals",
    title: "CAR Renewal Report",
    description:
      "Find policies due for renewal relative to a reference date with status and type filters.",
    icon: RefreshCwIcon,
  },
];

export default function ReportsIndexRoute() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Run operational reports on screen, then export to CSV."
        breadcrumbs={[{ label: "Reports" }]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((report) => (
          <Link
            key={report.to}
            to={report.to}
            className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <report.icon className="size-5" />
                  </span>
                  <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <CardTitle className="text-base">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
