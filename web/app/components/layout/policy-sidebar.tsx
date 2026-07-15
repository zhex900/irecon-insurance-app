import { useMemo, useState } from "react";
import { NavLink } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import type { CarStatus, PolicySummary } from "~/lib/db/types";
import { cn } from "~/lib/utils";

export function PolicySidebar({
  policies,
  carStatuses,
}: {
  policies: PolicySummary[];
  carStatuses: CarStatus[];
}) {
  const [search, setSearch] = useState("");

  const filteredPolicies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return policies;
    return policies.filter(
      (policy) =>
        policy.policyNumber.toLowerCase().includes(q) ||
        policy.insuredName.toLowerCase().includes(q) ||
        policy.clientName.toLowerCase().includes(q) ||
        String(policy.policyId).includes(q),
    );
  }, [policies, search]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Policies
        </p>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search policy number or name"
          className="mt-2 h-9"
          aria-label="Search policies"
        />
      </div>

      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto lg:max-h-[calc(100vh-22rem)]">
        {filteredPolicies.length === 0 ? (
          <p className="px-1 py-2 text-sm text-slate-500">No policies found.</p>
        ) : (
          filteredPolicies.map((policy) => (
            <PolicyNavItem
              key={policy.policyId}
              policy={policy}
              statusName={
                carStatuses.find((status) => status.carStatusId === policy.carStatusId)
                  ?.name ?? "Unknown"
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function PolicyNavItem({
  policy,
  statusName,
}: {
  policy: PolicySummary;
  statusName: string;
}) {
  return (
    <NavLink to={`/quotes/${policy.policyId}`}>
      {({ isActive }) => (
        <div
          className={cn(
            "flex flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors",
            isActive
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100",
          )}
        >
          <span className="text-sm font-medium">{policy.policyNumber}</span>
          <span
            className={cn(
              "truncate text-xs",
              isActive ? "text-slate-300" : "text-slate-500",
            )}
          >
            {policy.insuredName || policy.clientName}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              className={cn(
                isActive
                  ? "border-slate-700 bg-slate-800 text-slate-100"
                  : "border-slate-200 bg-white text-slate-600",
              )}
            >
              {statusName}
            </Badge>
            {policy.isDraft ? (
              <Badge
                className={cn(
                  isActive
                    ? "border-amber-700 bg-amber-900 text-amber-100"
                    : "border-amber-200 bg-amber-50 text-amber-800",
                )}
              >
                Draft
              </Badge>
            ) : null}
          </div>
        </div>
      )}
    </NavLink>
  );
}
