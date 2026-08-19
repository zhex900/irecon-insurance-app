/**
 * Backend-driven user list queries.
 */
import { asc, ilike, or, sql } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import { appUser } from "~/lib/db/schema";
import type { AppUser } from "~/lib/db/types";
import { type PageResult, toPageResult } from "~/lib/pagination";
import { likePattern, resolvePage } from "~/lib/services/shared/list-query";
import { normalizeAppUser } from "~/lib/services/users/normalize";

export async function listUsersPage(input: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<PageResult<AppUser>> {
  const db = getDb();
  const pagination = resolvePage(input);
  const q = input.search?.trim();
  const where = q
    ? or(
        ilike(appUser.fullName, likePattern(q)),
        ilike(appUser.email, likePattern(q)),
        ilike(appUser.role, likePattern(q)),
      )
    : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appUser)
    .where(where);

  const rows = await db
    .select()
    .from(appUser)
    .where(where)
    .orderBy(asc(appUser.fullName))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return toPageResult(
    rows.map(normalizeAppUser),
    Number(countRow?.count ?? 0),
    pagination,
  );
}
