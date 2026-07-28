/**
 * Backend-driven policy list queries: SQL filters + limit/offset + counts.
 */
import {
  and,
  desc,
  eq,
  ilike,
  isNotNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import {
  client,
  policy,
  policyCar,
  policyCarAdjustment,
} from "~/lib/db/schema";
import { type PageResult, toPageResult } from "~/lib/pagination";
import { likePattern, resolvePage } from "~/lib/services/shared/list-query";

export type PolicyListClientSummary = {
  clientId: number;
  name: string;
  tradingName: string;
  abn: string;
  phone: string;
  email: string;
  accountManagerId: number;
};

export type PolicyListItem = {
  policyId: number;
  policyNumber: string;
  clientId: number;
  clientName: string;
  client: PolicyListClientSummary;
  policyStatusId: number;
  policyCategoryId: number;
  coverTypeId: number;
  insuredName: string;
  dateStart: string;
  dateEnd: string;
  isDraft: boolean;
  adjusted: boolean;
  originalTotalPremium: number | null;
  createdWhen: string;
};

export type ListPoliciesPageInput = {
  search?: string;
  policyStatusId?: number | null;
  clientId?: number | null;
  limit?: number;
  offset?: number;
};

export type ListPoliciesPageResult = PageResult<PolicyListItem> & {
  statusCounts: Record<number, number>;
};

export async function listPoliciesPage(
  input: ListPoliciesPageInput = {},
): Promise<ListPoliciesPageResult> {
  const db = getDb();
  const pagination = resolvePage(input);
  const filters: SQL[] = [];

  if (input.clientId) {
    filters.push(eq(policy.clientId, input.clientId));
  }
  if (input.policyStatusId) {
    filters.push(eq(policy.policyStatusId, input.policyStatusId));
  }

  const q = input.search?.trim();
  if (q) {
    const pattern = likePattern(q);
    const textOr: SQL[] = [
      ilike(policy.policyNumber, pattern),
      ilike(policyCar.insuredName, pattern),
      ilike(client.name, pattern),
      ilike(client.tradingName, pattern),
    ];
    if (/^\d+$/.test(q)) {
      textOr.push(eq(policy.policyId, Number(q)));
    }
    if (q.toLowerCase() === "adjusted") {
      textOr.push(isNotNull(policyCarAdjustment.policyId));
    }
    filters.push(or(...textOr)!);
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .leftJoin(
      policyCarAdjustment,
      eq(policy.policyId, policyCarAdjustment.policyId),
    )
    .where(where);

  // Status counts ignore the status filter but keep search/client filters.
  const statusWhereFilters: SQL[] = [];
  if (input.clientId) {
    statusWhereFilters.push(eq(policy.clientId, input.clientId));
  }
  if (q) {
    const pattern = likePattern(q);
    const textOr: SQL[] = [
      ilike(policy.policyNumber, pattern),
      ilike(policyCar.insuredName, pattern),
      ilike(client.name, pattern),
      ilike(client.tradingName, pattern),
    ];
    if (/^\d+$/.test(q)) textOr.push(eq(policy.policyId, Number(q)));
    if (q.toLowerCase() === "adjusted") {
      textOr.push(isNotNull(policyCarAdjustment.policyId));
    }
    statusWhereFilters.push(or(...textOr)!);
  }
  const statusWhere =
    statusWhereFilters.length > 0 ? and(...statusWhereFilters) : undefined;

  const statusRows = await db
    .select({
      policyStatusId: policy.policyStatusId,
      count: sql<number>`count(*)::int`,
    })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .leftJoin(
      policyCarAdjustment,
      eq(policy.policyId, policyCarAdjustment.policyId),
    )
    .where(statusWhere)
    .groupBy(policy.policyStatusId);

  const statusCounts: Record<number, number> = {};
  for (const row of statusRows) {
    statusCounts[row.policyStatusId] = Number(row.count);
  }

  const rows = await db
    .select({
      policyId: policy.policyId,
      policyNumber: policy.policyNumber,
      clientId: policy.clientId,
      clientName: client.name,
      clientTradingName: client.tradingName,
      clientAbn: client.abn,
      clientPhone: client.phone,
      clientEmail: client.email,
      clientAccountManagerId: client.accountManagerId,
      policyStatusId: policy.policyStatusId,
      policyCategoryId: policy.policyCategoryId,
      coverTypeId: policyCar.coverTypeId,
      insuredName: policyCar.insuredName,
      dateStart: policy.dateStart,
      dateEnd: policy.dateEnd,
      isDraft: policy.isDraft,
      adjustmentPolicyId: policyCarAdjustment.policyId,
      originalTotalPremium: policyCar.originalTotalPremium,
      createdWhen: policy.createdWhen,
    })
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(client, eq(policy.clientId, client.clientId))
    .leftJoin(
      policyCarAdjustment,
      eq(policy.policyId, policyCarAdjustment.policyId),
    )
    .where(where)
    .orderBy(desc(policy.createdWhen), desc(policy.policyId))
    .limit(pagination.limit)
    .offset(pagination.offset);

  const items: PolicyListItem[] = rows.map((row) => {
    const clientName = row.clientName?.trim() || "—";
    return {
      policyId: row.policyId,
      policyNumber: row.policyNumber,
      clientId: row.clientId,
      clientName,
      client: {
        clientId: row.clientId,
        name: clientName,
        tradingName: row.clientTradingName?.trim() ?? "",
        abn: row.clientAbn?.trim() ?? "",
        phone: row.clientPhone?.trim() ?? "",
        email: row.clientEmail?.trim() ?? "",
        accountManagerId: row.clientAccountManagerId ?? 0,
      },
      policyStatusId: row.policyStatusId,
      policyCategoryId: row.policyCategoryId,
      coverTypeId: row.coverTypeId,
      insuredName: row.insuredName ?? "",
      dateStart: row.dateStart.toISOString().slice(0, 10),
      dateEnd: row.dateEnd.toISOString().slice(0, 10),
      isDraft: Boolean(row.isDraft),
      adjusted: row.adjustmentPolicyId != null,
      originalTotalPremium:
        row.originalTotalPremium == null
          ? null
          : Number(row.originalTotalPremium),
      createdWhen: row.createdWhen.toISOString(),
    };
  });

  return {
    ...toPageResult(items, Number(countRow?.count ?? 0), pagination),
    statusCounts,
  };
}
