/**
 * Backend-driven client list queries: SQL filters + limit/offset + counts.
 */
import { and, asc, eq, ilike, not, or, type SQL, sql } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import {
  accountManager,
  authorisedRepresentative,
  client,
  policy,
} from "~/lib/db/schema";
import type { Client } from "~/lib/db/types";
import { type PageResult, toPageResult } from "~/lib/pagination";
import { normalizeClient } from "~/lib/services/clients/normalize";
import {
  digitsOnly,
  isDigitSearchQuery,
  likePattern,
  resolvePage,
} from "~/lib/services/shared/list-query";

export type ClientListItem = Client & { policyCount: number };

export type ListClientsPageInput = {
  search?: string;
  accountManagerId?: number | null;
  authorisedRepresentativeId?: number | null;
  arCompanyName?: string | null;
  policyFilter?: "all" | "with" | "without";
  limit?: number;
  offset?: number;
};

export type ListClientsPageResult = PageResult<ClientListItem> & {
  withPolicies: number;
  withoutPolicies: number;
};

function buildClientFilters(input: ListClientsPageInput): SQL[] {
  const filters: SQL[] = [];

  if (input.accountManagerId) {
    filters.push(eq(client.accountManagerId, input.accountManagerId));
  }
  if (input.authorisedRepresentativeId) {
    filters.push(
      eq(client.authorisedRepresentativeId, input.authorisedRepresentativeId),
    );
  }
  if (input.arCompanyName?.trim()) {
    filters.push(
      sql`lower(${authorisedRepresentative.companyName}) = ${input.arCompanyName.trim().toLowerCase()}`,
    );
  }

  const q = input.search?.trim();
  if (q) {
    const pattern = likePattern(q);
    const qDigits = digitsOnly(q);

    const textOr: SQL[] = [
      ilike(client.name, pattern),
      ilike(client.tradingName, pattern),
      ilike(client.email, pattern),
      ilike(client.abn, pattern),
      ilike(client.phone, pattern),
      ilike(authorisedRepresentative.fullName, pattern),
      ilike(authorisedRepresentative.companyName, pattern),
      ilike(accountManager.fullName, pattern),
    ];
    // Only strip formatting for pure numeric queries (e.g. "02 1234").
    // "w018" must not match phones/ABNs that merely contain "018".
    if (isDigitSearchQuery(q) && qDigits.length > 0) {
      const digitPattern = `%${qDigits}%`;
      textOr.push(
        sql`regexp_replace(${client.abn}, '[^0-9]', '', 'g') like ${digitPattern}`,
      );
      textOr.push(
        sql`regexp_replace(${client.phone}, '[^0-9]', '', 'g') like ${digitPattern}`,
      );
    }
    filters.push(or(...textOr)!);
  }

  return filters;
}

function clientPolicyExistsSql() {
  return sql`exists (select 1 from ${policy} p where p.client_id = ${client.clientId})`;
}

function clientHasPolicies() {
  return clientPolicyExistsSql();
}

async function countClientsSummary(
  whereForCounts: SQL | undefined,
): Promise<{
  allTotal: number;
  withPolicies: number;
  withoutPolicies: number;
}> {
  const db = getDb();
  const [row] = await db
    .select({
      allTotal: sql<number>`count(distinct ${client.clientId})::int`,
      withPolicies: sql<number>`count(distinct ${client.clientId}) filter (where ${clientPolicyExistsSql()})::int`,
    })
    .from(client)
    .leftJoin(
      accountManager,
      eq(client.accountManagerId, accountManager.accountManagerId),
    )
    .leftJoin(
      authorisedRepresentative,
      eq(
        client.authorisedRepresentativeId,
        authorisedRepresentative.authorisedRepresentativeId,
      ),
    )
    .where(whereForCounts);

  const allTotal = Number(row?.allTotal ?? 0);
  const withPolicies = Number(row?.withPolicies ?? 0);
  return {
    allTotal,
    withPolicies,
    withoutPolicies: allTotal - withPolicies,
  };
}

export async function listClientsPage(
  input: ListClientsPageInput = {},
): Promise<ListClientsPageResult> {
  const db = getDb();
  const pagination = resolvePage(input);
  const filters = buildClientFilters(input);

  const policyFilterSql =
    input.policyFilter === "with"
      ? clientHasPolicies()
      : input.policyFilter === "without"
        ? not(clientHasPolicies())
        : undefined;

  const whereParts = [...filters];
  if (policyFilterSql) whereParts.push(policyFilterSql);
  const where = whereParts.length > 0 ? and(...whereParts) : undefined;
  const whereForCounts = filters.length > 0 ? and(...filters) : undefined;

  // Workers postgres pools are small — one combined count scan, then list rows.
  const policyCountByClient = db
    .select({
      clientId: policy.clientId,
      count: sql<number>`count(*)::int`.as("policy_count"),
    })
    .from(policy)
    .groupBy(policy.clientId)
    .as("policy_count_by_client");

  const [{ allTotal, withPolicies, withoutPolicies }, listRows] =
    await Promise.all([
      countClientsSummary(whereForCounts),
      db
        .select({
          client,
          policyCount:
            sql<number>`coalesce(${policyCountByClient.count}, 0)::int`.as(
              "policy_count",
            ),
        })
        .from(client)
        .leftJoin(
          accountManager,
          eq(client.accountManagerId, accountManager.accountManagerId),
        )
        .leftJoin(
          authorisedRepresentative,
          eq(
            client.authorisedRepresentativeId,
            authorisedRepresentative.authorisedRepresentativeId,
          ),
        )
        .leftJoin(
          policyCountByClient,
          eq(client.clientId, policyCountByClient.clientId),
        )
        .where(where)
        .orderBy(asc(client.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
    ]);

  let filteredTotal = allTotal;
  if (input.policyFilter === "with") filteredTotal = withPolicies;
  else if (input.policyFilter === "without") filteredTotal = withoutPolicies;

  const rows: ClientListItem[] = listRows.map((row) => ({
    ...normalizeClient(row.client),
    policyCount: Number(row.policyCount),
  }));

  return {
    ...toPageResult(rows, filteredTotal, pagination),
    withPolicies,
    withoutPolicies,
  };
}
