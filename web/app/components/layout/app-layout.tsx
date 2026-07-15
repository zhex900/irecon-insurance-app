import * as React from "react";
import { NavLink, Outlet, Form } from "react-router";
import { PolicySidebar } from "~/components/layout/policy-sidebar";
import { cn } from "~/lib/utils";
import type { BrokerSession, CarStatus, PolicySummary } from "~/lib/db/types";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/clients", label: "Clients", icon: "clients" },
] as const;

export function AppLayout({
  broker,
  policies,
  carStatuses,
}: {
  broker: BrokerSession;
  policies: PolicySummary[];
  carStatuses: CarStatus[];
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-6 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                CAR Insurance
              </p>
              <h1 className="text-lg font-semibold text-slate-900">
                Broker Portal
              </h1>
              <p className="mt-1 text-sm text-slate-500">{broker.fullName}</p>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100",
                      isActive && "bg-slate-900 text-white hover:bg-slate-900",
                    )
                  }
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <PolicySidebar policies={policies} carStatuses={carStatuses} />
            <Form method="post" action="/logout" className="mt-auto">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <NavIcon name="logout" />
                Sign out
              </button>
            </Form>
          </div>
        </aside>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        {description ? (
          <div className="mt-1 text-sm text-slate-500">{description}</div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <NavIcon name="document" className="mb-4 size-10 text-slate-400" />
      <h3 className="text-lg font-medium text-slate-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

function NavIcon({
  name,
  className = "size-4",
}: {
  name: "dashboard" | "clients" | "logout" | "document";
  className?: string;
}) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      );
    case "clients":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "logout":
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case "document":
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
  }
}
