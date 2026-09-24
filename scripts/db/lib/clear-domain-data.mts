/**
 * Delete policies / clients and related rows (CAR tables, audit, recents).
 * Used by scripts/db/clear/clear-policies.mts and scripts/db/clear/clear-clients.mts.
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { getDb } from "../../../app/lib/db/client";
import {
  accountManager,
  appUser,
  appUserRecentRoute,
  auditLog,
  authorisedRepresentative,
  client,
  policy,
} from "../../../app/lib/db/schema";

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.replace(/^postgres:/, "postgresql:")).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

export function maskDatabaseUrl(url: string | undefined): string {
  if (!url?.trim()) return "(unset)";
  try {
    const parsed = new URL(url.replace(/^postgres:/, "postgresql:"));
    parsed.password = parsed.password ? "****" : "";
    return parsed.toString();
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

async function countPolicies(clientId?: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(policy)
    .where(clientId ? eq(policy.clientId, clientId) : undefined);
  return Number(row?.count ?? 0);
}

async function countClients(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(client);
  return Number(row?.count ?? 0);
}

async function cleanupPolicySideEffects(options: {
  policyIds?: string[];
  allPolicies?: boolean;
}) {
  const db = getDb();

  if (options.policyIds?.length) {
    await db
      .delete(auditLog)
      .where(
        and(
          eq(auditLog.entityType, "policy"),
          inArray(auditLog.entityId, options.policyIds),
        ),
      );
    for (const policyId of options.policyIds) {
      await db
        .delete(appUserRecentRoute)
        .where(eq(appUserRecentRoute.path, `/policies/${policyId}`));
    }
    return;
  }

  if (options.allPolicies) {
    await db.delete(auditLog).where(eq(auditLog.entityType, "policy"));
    await db
      .delete(appUserRecentRoute)
      .where(sql`${appUserRecentRoute.path} like '/policies/%'`);
  }
}

async function cleanupClientSideEffects(clientIds: string[]) {
  const db = getDb();
  if (clientIds.length === 0) return;

  await db
    .delete(auditLog)
    .where(
      and(
        eq(auditLog.entityType, "client"),
        inArray(auditLog.entityId, clientIds),
      ),
    );

  for (const clientId of clientIds) {
    await db
      .delete(appUserRecentRoute)
      .where(eq(appUserRecentRoute.path, `/clients/${clientId}`));
  }
}

async function listPolicyIds(clientId?: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ policyId: policy.policyId })
    .from(policy)
    .where(clientId ? eq(policy.clientId, clientId) : undefined);
  return rows.map((row) => row.policyId);
}

/** Reset ATCCWI number sequence after a full policy wipe (dev / preview only). */
async function restartPolicyNumberSeq() {
  const db = getDb();
  await db.execute(sql`select setval('policy_number_seq', 1000, false)`);
}

export type ClearSummary = {
  policiesRemoved: number;
  clientsRemoved: number;
};

export type AccountManagersClearSummary = {
  accountManagersRemoved: number;
  clientsRemoved: number;
  policiesRemoved: number;
};

export type ArClearSummary = {
  authorisedRepresentativesRemoved: number;
  appUsersUnlinked: number;
  clientsWithOrphanedAr: number;
};

export type LegacyDomainClearSummary = {
  policies: ClearSummary;
  accountManagers: AccountManagersClearSummary;
  ar: ArClearSummary;
};

export type ClearRunOptions = {
  dryRun?: boolean;
  clientId?: string;
  id?: number;
};

export async function clearPolicies(options?: {
  clientId?: string;
  dryRun?: boolean;
}): Promise<ClearSummary> {
  const policyCount = await countPolicies(options?.clientId);
  if (options?.dryRun) {
    return { policiesRemoved: policyCount, clientsRemoved: 0 };
  }

  const db = getDb();
  const policyIds = await listPolicyIds(options?.clientId);

  if (options?.clientId) {
    await db.delete(policy).where(eq(policy.clientId, options.clientId));
  } else {
    await db.execute(sql`
      truncate table
        policy_car_selected_wording,
        policy_note,
        policy_document,
        policy_car_adjustment,
        policy_car,
        policy,
        policy_series
      restart identity cascade
    `);
    await restartPolicyNumberSeq();
  }

  await cleanupPolicySideEffects(
    options?.clientId ? { policyIds } : { allPolicies: true },
  );

  return { policiesRemoved: policyCount, clientsRemoved: 0 };
}

export async function clearClients(options?: {
  clientId?: string;
  dryRun?: boolean;
}): Promise<ClearSummary> {
  const clientCount = options?.clientId ? 1 : await countClients();
  const policyCount = await countPolicies(options?.clientId);

  if (options?.dryRun) {
    return { policiesRemoved: policyCount, clientsRemoved: clientCount };
  }

  const db = getDb();
  const clientIds = options?.clientId
    ? [options.clientId]
    : (await db.select({ clientId: client.clientId }).from(client)).map(
        (row) => row.clientId,
      );

  await clearPolicies({ clientId: options?.clientId });

  if (options?.clientId) {
    await db.delete(client).where(eq(client.clientId, options.clientId));
  } else {
    await db.execute(sql`truncate table client restart identity cascade`);
  }

  await cleanupClientSideEffects(clientIds);

  return { policiesRemoved: policyCount, clientsRemoved: clientCount };
}

async function countAccountManagers(id?: number): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accountManager)
    .where(id ? eq(accountManager.accountManagerId, id) : undefined);
  return Number(row?.count ?? 0);
}

async function countAuthorisedRepresentatives(id?: number): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authorisedRepresentative)
    .where(
      id
        ? eq(authorisedRepresentative.authorisedRepresentativeId, id)
        : undefined,
    );
  return Number(row?.count ?? 0);
}

async function countClientsForAccountManager(
  accountManagerId: number,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(client)
    .where(eq(client.accountManagerId, accountManagerId));
  return Number(row?.count ?? 0);
}

async function countClientsForAuthorisedRepresentative(
  authorisedRepresentativeId: number,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(client)
    .where(eq(client.authorisedRepresentativeId, authorisedRepresentativeId));
  return Number(row?.count ?? 0);
}

async function countAppUsersForAuthorisedRepresentative(
  authorisedRepresentativeId?: number,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appUser)
    .where(
      authorisedRepresentativeId
        ? eq(appUser.authorisedRepresentativeId, authorisedRepresentativeId)
        : isNotNull(appUser.authorisedRepresentativeId),
    );
  return Number(row?.count ?? 0);
}

async function cleanupAccountManagerSideEffects(options: {
  accountManagerIds?: number[];
  allAccountManagers?: boolean;
}) {
  const db = getDb();

  if (options.accountManagerIds?.length) {
    await db
      .delete(auditLog)
      .where(
        and(
          eq(auditLog.entityType, "account_manager"),
          inArray(auditLog.entityId, options.accountManagerIds.map(String)),
        ),
      );
    return;
  }

  if (options.allAccountManagers) {
    await db.delete(auditLog).where(eq(auditLog.entityType, "account_manager"));
  }
}

async function cleanupArSideEffects(options: {
  arIds?: number[];
  allArs?: boolean;
}) {
  const db = getDb();

  if (options.arIds?.length) {
    await db
      .delete(auditLog)
      .where(
        and(
          eq(auditLog.entityType, "ar"),
          inArray(auditLog.entityId, options.arIds.map(String)),
        ),
      );
    return;
  }

  if (options.allArs) {
    await db.delete(auditLog).where(eq(auditLog.entityType, "ar"));
  }
}

async function unlinkAppUsersFromAuthorisedRepresentative(
  authorisedRepresentativeId?: number,
) {
  const db = getDb();
  await db
    .update(appUser)
    .set({ authorisedRepresentativeId: null })
    .where(
      authorisedRepresentativeId
        ? eq(appUser.authorisedRepresentativeId, authorisedRepresentativeId)
        : isNotNull(appUser.authorisedRepresentativeId),
    );
}

export async function clearAccountManagers(
  options?: ClearRunOptions,
): Promise<AccountManagersClearSummary> {
  const accountManagerCount = await countAccountManagers(options?.id);
  const clientCount = options?.id
    ? await countClientsForAccountManager(options.id)
    : await countClients();
  const policyCount = options?.id
    ? await countPoliciesForAccountManager(options.id)
    : await countPolicies();

  if (options?.dryRun) {
    return {
      accountManagersRemoved: accountManagerCount,
      clientsRemoved: clientCount,
      policiesRemoved: policyCount,
    };
  }

  if (options?.id) {
    if (clientCount > 0) {
      throw new Error(
        `Account manager ${options.id} is assigned to ${clientCount} client(s). ` +
          "Clear clients first or run a full account-manager wipe.",
      );
    }

    const db = getDb();
    await db
      .delete(accountManager)
      .where(eq(accountManager.accountManagerId, options.id));
    await cleanupAccountManagerSideEffects({
      accountManagerIds: [options.id],
    });

    return {
      accountManagersRemoved: accountManagerCount,
      clientsRemoved: 0,
      policiesRemoved: 0,
    };
  }

  const db = getDb();
  const clientIds = (
    await db.select({ clientId: client.clientId }).from(client)
  ).map((row) => row.clientId);

  await db.execute(
    sql`truncate table account_manager restart identity cascade`,
  );
  await restartPolicyNumberSeq();
  await cleanupPolicySideEffects({ allPolicies: true });
  await cleanupClientSideEffects(clientIds);
  await cleanupAccountManagerSideEffects({ allAccountManagers: true });

  return {
    accountManagersRemoved: accountManagerCount,
    clientsRemoved: clientCount,
    policiesRemoved: policyCount,
  };
}

async function countPoliciesForAccountManager(
  accountManagerId: number,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(policy)
    .innerJoin(client, eq(policy.clientId, client.clientId))
    .where(eq(client.accountManagerId, accountManagerId));
  return Number(row?.count ?? 0);
}

export async function clearAuthorisedRepresentatives(
  options?: ClearRunOptions,
): Promise<ArClearSummary> {
  const arCount = await countAuthorisedRepresentatives(options?.id);
  const appUsersUnlinked = await countAppUsersForAuthorisedRepresentative(
    options?.id,
  );
  const clientsWithOrphanedAr = options?.id
    ? await countClientsForAuthorisedRepresentative(options.id)
    : await countClients();

  if (options?.dryRun) {
    return {
      authorisedRepresentativesRemoved: arCount,
      appUsersUnlinked,
      clientsWithOrphanedAr,
    };
  }

  const db = getDb();

  if (options?.id) {
    await unlinkAppUsersFromAuthorisedRepresentative(options.id);
    await db
      .delete(authorisedRepresentative)
      .where(
        eq(authorisedRepresentative.authorisedRepresentativeId, options.id),
      );
    await cleanupArSideEffects({ arIds: [options.id] });
  } else {
    await unlinkAppUsersFromAuthorisedRepresentative();
    await db.execute(
      sql`truncate table authorised_representative restart identity cascade`,
    );
    await cleanupArSideEffects({ allArs: true });
  }

  return {
    authorisedRepresentativesRemoved: arCount,
    appUsersUnlinked,
    clientsWithOrphanedAr,
  };
}

/** Wipe legacy-migrated domain data (policies → clients → account managers → AR). */
export async function clearLegacyDomain(options?: {
  dryRun?: boolean;
}): Promise<LegacyDomainClearSummary> {
  const clients = await clearClients({ dryRun: options?.dryRun });
  const accountManagers = await clearAccountManagers({
    dryRun: options?.dryRun,
  });
  const ar = await clearAuthorisedRepresentatives({ dryRun: options?.dryRun });
  return {
    policies: {
      policiesRemoved: clients.policiesRemoved,
      clientsRemoved: clients.clientsRemoved,
    },
    accountManagers,
    ar,
  };
}
