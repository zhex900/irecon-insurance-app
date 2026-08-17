import { asc, ilike, or, sql } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import { authorisedRepresentative } from "~/lib/db/schema";
import type { WholesaleBroker } from "~/lib/db/types";
import { type PageResult, toPageResult } from "~/lib/pagination";
import { normalizeAuthorisedRepresentative } from "~/lib/services/authorised-representatives/normalize";
import { likePattern, resolvePage } from "~/lib/services/shared/list-query";

export async function listAuthorisedRepresentativesPage(input: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<PageResult<WholesaleBroker>> {
  const db = getDb();
  const pagination = resolvePage(input);
  const q = input.search?.trim();
  const where = q
    ? or(
        ilike(authorisedRepresentative.fullName, likePattern(q)),
        ilike(authorisedRepresentative.companyName, likePattern(q)),
        ilike(authorisedRepresentative.arNumber, likePattern(q)),
        ilike(authorisedRepresentative.email, likePattern(q)),
      )
    : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authorisedRepresentative)
    .where(where);

  const rows = await db
    .select()
    .from(authorisedRepresentative)
    .where(where)
    .orderBy(asc(authorisedRepresentative.fullName))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return toPageResult(
    rows.map(normalizeAuthorisedRepresentative),
    Number(countRow?.count ?? 0),
    pagination,
  );
}
