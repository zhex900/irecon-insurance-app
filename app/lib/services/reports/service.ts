import type { Client, Policy, WholesaleBroker } from "~/lib/db/types";
import { POLICY_STATUS } from "~/lib/zod/policy-car";

export const CAR_SEARCH_STATUSES = [
  "Taken - New",
  "Not taken",
  "Pending",
  "Taken Renewal",
  "Not Taken Renewal",
  "Pending Renewal",
] as const;

export type CarSearchStatus = (typeof CAR_SEARCH_STATUSES)[number];

export type ReportPolicyRow = {
  policyId: number;
  policyNumber: string;
  clientId: number;
  clientName: string;
  arName: string;
  arEmail: string;
  policyCategoryId: number;
  policyCategoryName: string;
  policyStatusId: number;
  statusName: string;
  createdWhen: string;
  dateEnd: string;
  basePremium: number;
  carSearchStatus: CarSearchStatus;
};

function combinedBasePremium(policy: Policy): number {
  const premium = policy.car.premium;
  if (!premium) return 0;
  return (
    (premium.contractWorksBasePremium ?? 0) +
    (premium.liabilityBasePremium ?? 0)
  );
}

export function resolveCarSearchStatus(
  policyStatusId: number,
  policyCategoryId: number,
): CarSearchStatus {
  const isRenewal = policyCategoryId === 2;
  if (policyStatusId === POLICY_STATUS.Taken) {
    return isRenewal ? "Taken Renewal" : "Taken - New";
  }
  if (policyStatusId === POLICY_STATUS.NotTaken) {
    return isRenewal ? "Not Taken Renewal" : "Not taken";
  }
  return isRenewal ? "Pending Renewal" : "Pending";
}

function startOfDay(isoDate: string): Date {
  const d = new Date(`${isoDate}T00:00:00`);
  return d;
}

function endOfDay(isoDate: string): Date {
  const d = new Date(`${isoDate}T23:59:59.999`);
  return d;
}

/** Calendar-day difference: dateEnd − reference (positive = expires in future). */
export function dueNextDays(referenceDate: string, dateEnd: string): number {
  const ref = startOfDay(referenceDate).getTime();
  const end = startOfDay(dateEnd.slice(0, 10)).getTime();
  return Math.round((end - ref) / (24 * 60 * 60 * 1000));
}

/** Default period: 1 year ago → today (includes current activity). */
export function defaultCarPolicyPeriod(now = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const to = new Date(now);
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - 1);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

/** Default client report period: calendar year (Jan 1 → Dec 31). */
export function defaultClientReportPeriod(now = new Date()): {
  dateFrom: string;
  dateTo: string;
} {
  const year = now.getFullYear();
  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  };
}

export type ClientReportRow = {
  policyId: number;
  clientId: number;
  clientName: string;
  turnoverLimit: number;
  dateEnd: string;
};

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function buildReportPolicyRows(
  policies: Policy[],
  clients: Client[],
  brokers: WholesaleBroker[],
  statusNames: Map<number, string>,
  policyCategoryNames: Map<number, string>,
): ReportPolicyRow[] {
  const clientById = new Map(clients.map((c) => [c.clientId, c]));
  const brokerById = new Map(
    brokers.map((b) => [b.authorisedRepresentativeId, b]),
  );

  return policies.map((policy) => {
    const client = clientById.get(policy.clientId);
    const broker = client
      ? brokerById.get(client.authorisedRepresentativeId)
      : undefined;
    return {
      policyId: policy.policyId,
      policyNumber: policy.policyNumber,
      clientId: policy.clientId,
      clientName: client?.name ?? "—",
      arName: broker?.fullName?.trim() ?? "",
      arEmail: broker?.email?.trim() ?? "",
      policyCategoryId: policy.policyCategoryId,
      policyCategoryName:
        policyCategoryNames.get(policy.policyCategoryId) ?? "—",
      policyStatusId: policy.policyStatusId,
      statusName: statusNames.get(policy.policyStatusId) ?? "—",
      createdWhen: policy.createdWhen,
      dateEnd: policy.dateEnd,
      basePremium: combinedBasePremium(policy),
      carSearchStatus: resolveCarSearchStatus(
        policy.policyStatusId,
        policy.policyCategoryId,
      ),
    };
  });
}

export type CarPolicySummaryRow = {
  status: CarSearchStatus;
  policyCount: number;
  totalBasePremium: number;
  policies: ReportPolicyRow[];
};

/** CAR Policy Report: filter by createdWhen period, summarise by CARSearchStatus. */
export function buildCarPolicyReport(
  rows: ReportPolicyRow[],
  dateFrom: string,
  dateTo: string,
): CarPolicySummaryRow[] {
  const from = startOfDay(dateFrom).getTime();
  const to = endOfDay(dateTo).getTime();

  const inPeriod = rows.filter((row) => {
    const created = new Date(row.createdWhen).getTime();
    return !Number.isNaN(created) && created >= from && created <= to;
  });

  return CAR_SEARCH_STATUSES.map((status) => {
    const policies = inPeriod.filter((row) => row.carSearchStatus === status);
    return {
      status,
      policyCount: policies.length,
      totalBasePremium: policies.reduce((sum, p) => sum + p.basePremium, 0),
      policies,
    };
  });
}

export type RenewalReportRow = ReportPolicyRow & {
  dueNextDays: number;
};

export function buildRenewalReport(
  rows: ReportPolicyRow[],
  opts: {
    referenceDate: string;
    statusIds: number[];
    policyCategoryIds: number[];
    search?: string;
  },
): RenewalReportRow[] {
  const q = opts.search?.trim().toLowerCase() ?? "";
  const statusSet = new Set(opts.statusIds);
  const typeSet = new Set(opts.policyCategoryIds);

  return rows
    .filter((row) => {
      if (statusSet.size > 0 && !statusSet.has(row.policyStatusId)) {
        return false;
      }
      if (typeSet.size > 0 && !typeSet.has(row.policyCategoryId)) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        row.clientName,
        row.arName,
        row.arEmail,
        row.policyNumber,
        row.statusName,
        row.policyCategoryName,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    })
    .map((row) => ({
      ...row,
      dueNextDays: dueNextDays(opts.referenceDate, row.dateEnd),
    }))
    .sort((a, b) => a.dueNextDays - b.dueNextDays);
}
