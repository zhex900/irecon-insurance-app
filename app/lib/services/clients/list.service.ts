/**
 * Backend-driven client list queries: SQL filters + limit/offset + counts.
 */
import {
  and,
  asc,
  eq,
  exists,
  ilike,
  inArray,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { authorisedRepresentative, client, policy } from "~/lib/db/schema";
import type { Client } from "~/lib/db/types";
import { type PageResult, toPageResult } from "~/lib/pagination";
import { getReferenceData } from "~/lib/services/reference.service";
import { likePattern, resolvePage } from "~/lib/services/shared/list-query";
import { normalizeClient } from "~/lib/services/clients/normalize";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

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
  const reference = getReferenceData();

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
    const qLower = q.toLowerCase();
    const qDigits = digitsOnly(q);
    const managerIds = reference.accountManagers
      .filter((m) => m.fullName.toLowerCase().includes(qLower))
      .map((m) => m.accountManagerId);

    const textOr: SQL[] = [
      ilike(client.name, pattern),
      ilike(client.tradingName, pattern),
      ilike(client.email, pattern),
      ilike(client.abn, pattern),
      ilike(client.phone, pattern),
      ilike(authorisedRepresentative.fullName, pattern),
      ilike(authorisedRepresentative.companyName, pattern),
    ];
    if (managerIds.length > 0) {
      textOr.push(inArray(client.accountManagerId, managerIds));
    }
    if (qDigits.length > 0) {
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

function clientHasPolicies() {
  const db = getDb();
  return exists(
    db
      .select({ one: sql`1` })
      .from(policy)
      .where(eq(policy.clientId, client.clientId)),
  );
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

  async function countClients(extra?: SQL) {
    const w =
      whereForCounts && extra
        ? and(whereForCounts, extra)
        : (extra ?? whereForCounts);
    const [row] = await db
      .select({ count: sql<number>`count(distinct ${client.clientId})::int` })
      .from(client)
      .leftJoin(
        authorisedRepresentative,
        eq(
          client.authorisedRepresentativeId,
          authorisedRepresentative.authorisedRepresentativeId,
        ),
      )
      .where(w);
    return Number(row?.count ?? 0);
  }

  const [allTotal, withPolicies, withoutPolicies] = await Promise.all([
    countClients(),
    countClients(clientHasPolicies()),
    countClients(not(clientHasPolicies())),
  ]);

  let filteredTotal = allTotal;
  if (input.policyFilter === "with") filteredTotal = withPolicies;
  else if (input.policyFilter === "without") filteredTotal = withoutPolicies;

  const listRows = await db
    .select({
      client,
      policyCount: sql<number>`(
        select count(*)::int from policy p where p.client_id = ${client.clientId}
      )`.as("policy_count"),
    })
    .from(client)
    .leftJoin(
      authorisedRepresentative,
      eq(
        client.authorisedRepresentativeId,
        authorisedRepresentative.authorisedRepresentativeId,
      ),
    )
    .where(where)
    .orderBy(asc(client.name))
    .limit(pagination.limit)
    .offset(pagination.offset);

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
