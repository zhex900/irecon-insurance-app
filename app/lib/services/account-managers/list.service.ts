import { asc, ilike, or, sql } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import { accountManager } from "~/lib/db/schema";
import type { AccountManager } from "~/lib/db/types";
import { type PageResult, toPageResult } from "~/lib/pagination";
import { normalizeAccountManager } from "~/lib/services/account-managers/normalize";
import { likePattern, resolvePage } from "~/lib/services/shared/list-query";

export async function listAccountManagersPage(input: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<PageResult<AccountManager>> {
  const db = getDb();
  const pagination = resolvePage(input);
  const q = input.search?.trim();
  const where = q
    ? or(
        ilike(accountManager.fullName, likePattern(q)),
        ilike(accountManager.abbrev, likePattern(q)),
        ilike(accountManager.arNumber, likePattern(q)),
        ilike(accountManager.email, likePattern(q)),
        ilike(accountManager.mobile, likePattern(q)),
      )
    : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accountManager)
    .where(where);

  const rows = await db
    .select()
    .from(accountManager)
    .where(where)
    .orderBy(asc(accountManager.fullName))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return toPageResult(
    rows.map(normalizeAccountManager),
    Number(countRow?.count ?? 0),
    pagination,
  );
}
