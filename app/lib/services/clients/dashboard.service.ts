import { eq, sql } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import { client, policy } from "~/lib/db/schema";

export async function getDashboardStats() {
  const db = getDb();
  const [clientCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(client);
  const [policyCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(policy);
  const [pendingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(policy)
    .where(eq(policy.policyStatusId, 1));
  const [takenCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(policy)
    .where(eq(policy.policyStatusId, 2));
  const [notTakenCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(policy)
    .where(eq(policy.policyStatusId, 3));

  return {
    clients: clientCount?.count ?? 0,
    policies: policyCount?.count ?? 0,
    pending: pendingCount?.count ?? 0,
    taken: takenCount?.count ?? 0,
    notTaken: notTakenCount?.count ?? 0,
  };
}
