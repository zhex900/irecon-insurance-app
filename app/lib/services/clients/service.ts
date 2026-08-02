import { asc, eq, inArray, sql } from "drizzle-orm";
import { getReferenceDataAsync } from "~/lib/services/reference.service";
import { getDb } from "~/lib/db/client";
import { client, policy } from "~/lib/db/schema";
import type { Client } from "~/lib/db/types";
import { isDigitSearchQuery } from "~/lib/services/shared/list-query";
import { normalizeClient } from "~/lib/services/clients/normalize";

export { normalizeClient };

export type ListClientsOptions = {
  search?: string;
  accountManagerId?: number | null;
  authorisedRepresentativeId?: number | null;
  arCompanyName?: string | null;
};

export async function listClients(options?: string | ListClientsOptions) {
  const filters: ListClientsOptions =
    typeof options === "string" ? { search: options } : (options ?? {});
  const db = getDb();
  const rows = await db.select().from(client).orderBy(asc(client.name));
  let clients = rows.map(normalizeClient);

  const hasText = Boolean(filters.search?.trim());
  const hasManager = Boolean(filters.accountManagerId);
  const hasAr = Boolean(filters.authorisedRepresentativeId);
  const hasArCompany = Boolean(filters.arCompanyName?.trim());
  if (!hasText && !hasManager && !hasAr && !hasArCompany) return clients;

  const reference = await getReferenceDataAsync();
  const managers = new Map(
    reference.accountManagers.map((m) => [
      m.accountManagerId,
      m.fullName.toLowerCase(),
    ]),
  );
  const ars = new Map(
    reference.wholesaleBrokers.map((ar) => [
      ar.authorisedRepresentativeId,
      {
        name: ar.fullName.toLowerCase(),
        company: ar.companyName.toLowerCase(),
      },
    ]),
  );

  if (hasManager) {
    clients = clients.filter(
      (item) => item.accountManagerId === filters.accountManagerId,
    );
  }
  if (hasAr) {
    clients = clients.filter(
      (item) =>
        item.authorisedRepresentativeId === filters.authorisedRepresentativeId,
    );
  }
  if (hasArCompany) {
    const companyQ = filters.arCompanyName!.trim().toLowerCase();
    clients = clients.filter((item) => {
      const ar = ars.get(item.authorisedRepresentativeId);
      return (ar?.company ?? "") === companyQ;
    });
  }

  if (!hasText) return clients;

  const q = filters.search!.toLowerCase().trim();
  const qDigits = q.replace(/\D/g, "");
  const digitSearch = isDigitSearchQuery(q);
  return clients.filter((item) => {
    const manager = managers.get(item.accountManagerId) ?? "";
    const ar = ars.get(item.authorisedRepresentativeId);
    return (
      item.name.toLowerCase().includes(q) ||
      item.tradingName.toLowerCase().includes(q) ||
      manager.includes(q) ||
      (ar?.name ?? "").includes(q) ||
      (ar?.company ?? "").includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.abn.toLowerCase().includes(q) ||
      item.phone.toLowerCase().includes(q) ||
      (digitSearch &&
        qDigits.length > 0 &&
        (item.abn.replace(/\D/g, "").includes(qDigits) ||
          item.phone.replace(/\D/g, "").includes(qDigits)))
    );
  });
}

export async function getClient(clientId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(client)
    .where(eq(client.clientId, clientId))
    .limit(1);
  return row ? normalizeClient(row) : null;
}

export async function getClientsByIds(clientIds: number[]) {
  const ids = [
    ...new Set(clientIds.filter((id) => Number.isInteger(id) && id > 0)),
  ];
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(client)
    .where(inArray(client.clientId, ids));
  const byId = new Map(rows.map((row) => [row.clientId, normalizeClient(row)]));
  return ids.map((id) => byId.get(id)).filter((row) => row != null);
}

export type ClientWritable = Omit<
  Client,
  "clientId" | "createdWhen" | "createdBy"
>;

export async function createClient(input: ClientWritable, createdBy: string) {
  const db = getDb();
  const [created] = await db
    .insert(client)
    .values({
      ...input,
      createdBy,
    })
    .returning();
  return normalizeClient(created);
}

/** Create an empty draft client (same pattern as createPolicyDraft). */
export async function createClientDraft(createdBy: string) {
  const reference = await getReferenceDataAsync();
  const firstManager = reference.accountManagers[0]?.accountManagerId ?? 1;
  const firstBroker =
    reference.wholesaleBrokers[0]?.authorisedRepresentativeId ?? 1;

  return createClient(
    {
      name: "",
      tradingName: "",
      abn: "",
      phone: "",
      email: "",
      accountManagerId: firstManager,
      clientSourceId: 16,
      authorisedRepresentativeId: firstBroker,
    },
    createdBy,
  );
}

export async function updateClient(clientId: number, input: ClientWritable) {
  const db = getDb();
  const [updated] = await db
    .update(client)
    .set({ ...input })
    .where(eq(client.clientId, clientId))
    .returning();
  if (!updated) throw new Error("Client not found");
  return normalizeClient(updated);
}

export async function countClientPolicies(clientId: number) {
  const db = getDb();
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(policy)
    .where(eq(policy.clientId, clientId));
  return Number(countRow?.count ?? 0);
}

/** Delete a client only when they have no policies. */
export async function deleteClient(clientId: number) {
  const existing = await getClient(clientId);
  if (!existing) throw new Error("Client not found");

  const policyCount = await countClientPolicies(clientId);
  if (policyCount > 0) {
    throw new Error("Clients with policies cannot be deleted");
  }

  const db = getDb();
  await db.delete(client).where(eq(client.clientId, clientId));
  return existing;
}
