/**
 * Backend-driven report list queries: slim columns + SQL filters.
 */
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import {
  authorisedRepresentative,
  client,
  policy,
  policyCar,
} from "~/lib/db/schema";
import { type PageResult, toPageResult } from "~/lib/pagination";
import { getReferenceData } from "~/lib/services/reference.service";
import {
  CAR_SEARCH_STATUSES,
  resolveCarSearchStatus,
  type CarPolicySummaryRow,
  type CarSearchStatus,
  type ClientReportRow,
  type ReportPolicyRow,
} from "~/lib/services/reports/service";
import { likePattern, resolvePage } from "~/lib/services/shared/list-query";
import { POLICY_STATUS } from "~/lib/zod/policy-car";

export type ListReportPoliciesInput = {
  dateFrom?: string;
  dateTo?: string;
  /** Filter on dateEnd window (renewals). */
  expiryFrom?: string;
  expiryTo?: string;
  statusIds?: number[];
  policyCategoryIds?: number[];
  search?: string;
  orderBy?: "createdWhen" | "dateEnd";
  limit?: number;
  offset?: number;
};

/** Map CAR search status label → policyStatusId + policyCategoryId filters. */
export function filtersForCarSearchStatus(
  status: ReportPolicyRow["carSearchStatus"],
): { statusIds: number[]; policyCategoryIds: number[] } {
  switch (status) {
    case "Taken - New":
      return { statusIds: [POLICY_STATUS.Taken], policyCategoryIds: [1] };
    case "Taken Renewal":
      return { statusIds: [POLICY_STATUS.Taken], policyCategoryIds: [2] };
    case "Not taken":
      return { statusIds: [POLICY_STATUS.NotTaken], policyCategoryIds: [1] };
    case "Not Taken Renewal":
      return { statusIds: [POLICY_STATUS.NotTaken], policyCategoryIds: [2] };
    case "Pending":
      return { statusIds: [POLICY_STATUS.Pending], policyCategoryIds: [1] };
    case "Pending Renewal":
      return { statusIds: [POLICY_STATUS.Pending], policyCategoryIds: [2] };
    default:
      return { statusIds: [], policyCategoryIds: [] };
  }
}

export async function listReportPoliciesPage(
  input: ListReportPoliciesInput = {},
): Promise<PageResult<ReportPolicyRow>> {
  const db = getDb();
  const pagination = resolvePage({
    ...input,
    pageSize: input.limit ?? 50,
  });
  const reference = getReferenceData();
  const statusNames = new Map(
    reference.policyStatuses.map((s) => [s.policyStatusId, s.name]),
  );
  const policyCategoryNames = new Map(
    reference.policyCategories.map((b) => [b.policyCategoryId, b.name]),
  );

  const filters: SQL[] = [];
  if (input.dateFrom) {
    filters.push(
      gte(policy.createdWhen, new Date(`${input.dateFrom}T00:00:00`)),
    );
  }
  if (input.dateTo) {
    filters.push(
      lte(policy.createdWhen, new Date(`${input.dateTo}T23:59:59.999`)),
    );
  }
  if (input.expiryFrom) {
    filters.push(gte(policy.dateEnd, new Date(`${input.expiryFrom}T00:00:00`)));
  }
  if (input.expiryTo) {
    filters.push(
      lte(policy.dateEnd, new Date(`${input.expiryTo}T23:59:59.999`)),
    );
  }
  if (input.statusIds?.length) {
    filters.push(inArray(policy.policyStatusId, input.statusIds));
  }
  if (input.policyCategoryIds?.length) {
    filters.push(inArray(policy.policyCategoryId, input.policyCategoryIds));
  }
  const q = input.search?.trim();
  if (q) {
    const pattern = likePattern(q);
    filters.push(
      or(
        ilike(client.name, pattern),
        ilike(client.tradingName, pattern),
        ilike(policy.policyNumber, pattern),
        ilike(authorisedRepresentative.fullName, pattern),
        ilike(authorisedRepresentative.email, pattern),
      )!,
    );
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .leftJoin(
      authorisedRepresentative,
      eq(
        client.authorisedRepresentativeId,
        authorisedRepresentative.authorisedRepresentativeId,
      ),
    )
    .where(where);

  const rows = await db
    .select({
      policyId: policy.policyId,
      policyNumber: policy.policyNumber,
      clientId: policy.clientId,
      clientName: client.name,
      arName: authorisedRepresentative.fullName,
      arEmail: authorisedRepresentative.email,
      policyCategoryId: policy.policyCategoryId,
      policyStatusId: policy.policyStatusId,
      createdWhen: policy.createdWhen,
      dateEnd: policy.dateEnd,
      contractWorksBasePremium: policyCar.contractWorksBasePremium,
      liabilityBasePremium: policyCar.liabilityBasePremium,
    })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .leftJoin(
      authorisedRepresentative,
      eq(
        client.authorisedRepresentativeId,
        authorisedRepresentative.authorisedRepresentativeId,
      ),
    )
    .where(where)
    .orderBy(
      input.orderBy === "dateEnd"
        ? asc(policy.dateEnd)
        : desc(policy.createdWhen),
      desc(policy.policyId),
    )
    .limit(pagination.limit)
    .offset(pagination.offset);

  const items: ReportPolicyRow[] = rows.map((row) => {
    const basePremium =
      Number(row.contractWorksBasePremium ?? 0) +
      Number(row.liabilityBasePremium ?? 0);
    return {
      policyId: row.policyId,
      policyNumber: row.policyNumber,
      clientId: row.clientId,
      clientName: row.clientName ?? "—",
      arName: row.arName?.trim() ?? "",
      arEmail: row.arEmail?.trim() ?? "",
      policyCategoryId: row.policyCategoryId,
      policyCategoryName: policyCategoryNames.get(row.policyCategoryId) ?? "—",
      policyStatusId: row.policyStatusId,
      statusName: statusNames.get(row.policyStatusId) ?? "—",
      createdWhen: row.createdWhen.toISOString(),
      dateEnd: row.dateEnd.toISOString(),
      basePremium,
      carSearchStatus: resolveCarSearchStatus(
        row.policyStatusId,
        row.policyCategoryId,
      ),
    };
  });

  return toPageResult(items, Number(countRow?.count ?? 0), pagination);
}

/**
 * Client report: one row per policy with client name, turnover limit, expiry.
 * Date filters apply to policy expiry (`dateEnd`). Empty from/to = no date filter.
 */
export async function listClientReportPage(
  input: {
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<PageResult<ClientReportRow>> {
  const db = getDb();
  const pagination = resolvePage({
    ...input,
    pageSize: input.limit ?? 50,
  });

  const filters: SQL[] = [];
  const from = input.dateFrom?.trim();
  const to = input.dateTo?.trim();
  if (from) {
    filters.push(gte(policy.dateEnd, new Date(`${from}T00:00:00`)));
  }
  if (to) {
    filters.push(lte(policy.dateEnd, new Date(`${to}T23:59:59.999`)));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .where(where);

  const rows = await db
    .select({
      policyId: policy.policyId,
      clientId: policy.clientId,
      clientName: client.name,
      turnoverLimit: policyCar.estimatedTurnover,
      dateEnd: policy.dateEnd,
    })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .where(where)
    .orderBy(asc(client.name), asc(policy.dateEnd), desc(policy.policyId))
    .limit(pagination.limit)
    .offset(pagination.offset);

  const items: ClientReportRow[] = rows.map((row) => ({
    policyId: row.policyId,
    clientId: row.clientId,
    clientName: row.clientName?.trim() || "—",
    turnoverLimit: Number(row.turnoverLimit ?? 0),
    dateEnd: row.dateEnd.toISOString(),
  }));

  return toPageResult(items, Number(countRow?.count ?? 0), pagination);
}

/** Aggregated CAR policy report — SQL group-by, no full-table hydrate. */
export async function getCarPolicyReportSummary(
  dateFrom: string,
  dateTo: string,
): Promise<CarPolicySummaryRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      policyStatusId: policy.policyStatusId,
      policyCategoryId: policy.policyCategoryId,
      policyCount: sql<number>`count(*)::int`,
      totalBasePremium: sql<number>`coalesce(sum(
        coalesce(${policyCar.contractWorksBasePremium}, 0) +
        coalesce(${policyCar.liabilityBasePremium}, 0)
      ), 0)::float`,
    })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .where(
      and(
        gte(policy.createdWhen, new Date(`${dateFrom}T00:00:00`)),
        lte(policy.createdWhen, new Date(`${dateTo}T23:59:59.999`)),
      ),
    )
    .groupBy(policy.policyStatusId, policy.policyCategoryId);

  const byStatus = new Map<
    CarSearchStatus,
    { policyCount: number; totalBasePremium: number }
  >();

  for (const row of rows) {
    const status = resolveCarSearchStatus(
      row.policyStatusId,
      row.policyCategoryId,
    );
    const prev = byStatus.get(status) ?? {
      policyCount: 0,
      totalBasePremium: 0,
    };
    byStatus.set(status, {
      policyCount: prev.policyCount + Number(row.policyCount),
      totalBasePremium: prev.totalBasePremium + Number(row.totalBasePremium),
    });
  }

  return CAR_SEARCH_STATUSES.map((status) => {
    const agg = byStatus.get(status) ?? {
      policyCount: 0,
      totalBasePremium: 0,
    };
    return {
      status,
      policyCount: agg.policyCount,
      totalBasePremium: agg.totalBasePremium,
      policies: [],
    };
  });
}
