/**
 * Global search across clients and policies.
 */
import { inArray } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { authorisedRepresentative } from "~/lib/db/schema";
import { listClientsPage } from "~/lib/services/clients/list.service";
import { listPoliciesPage } from "~/lib/services/policies/list.service";
import { getReferenceData } from "~/lib/services/reference.service";
import { normalizeAuthorisedRepresentative } from "~/lib/services/authorised-representatives/normalize";

export type GlobalSearchClientHit = {
  clientId: number;
  name: string;
  tradingName: string;
  abn: string;
  phone: string;
  email: string;
  accountManagerName: string;
  arName: string;
  arCompanyName: string;
};

export type GlobalSearchPolicyHit = {
  policyId: number;
  policyNumber: string;
  insuredName: string;
  clientName: string;
  clientId: number;
  statusName: string;
};

export async function searchGlobal(q: string, limit = 8) {
  const trimmed = q.trim();
  if (!trimmed) {
    return {
      clients: [] as GlobalSearchClientHit[],
      policies: [] as GlobalSearchPolicyHit[],
      clientTotal: 0,
      policyTotal: 0,
      total: 0,
    };
  }

  const [clientsPage, policiesPage] = await Promise.all([
    listClientsPage({ search: trimmed, limit, offset: 0 }),
    listPoliciesPage({ search: trimmed, limit, offset: 0 }),
  ]);

  const reference = getReferenceData();
  const managers = new Map(
    reference.accountManagers.map((m) => [m.accountManagerId, m.fullName]),
  );
  const statuses = new Map(
    reference.policyStatuses.map((s) => [s.policyStatusId, s.name]),
  );

  const db = getDb();
  const arIds = [
    ...new Set(clientsPage.rows.map((c) => c.authorisedRepresentativeId)),
  ];
  const arRows =
    arIds.length > 0
      ? await db
          .select()
          .from(authorisedRepresentative)
          .where(
            inArray(authorisedRepresentative.authorisedRepresentativeId, arIds),
          )
      : [];
  const arById = new Map(
    arRows.map((ar) => [
      ar.authorisedRepresentativeId,
      normalizeAuthorisedRepresentative(ar),
    ]),
  );

  const clientTotal = clientsPage.total;
  const policyTotal = policiesPage.total;

  return {
    clients: clientsPage.rows.map((c) => {
      const ar = arById.get(c.authorisedRepresentativeId);
      return {
        clientId: c.clientId,
        name: c.name,
        tradingName: c.tradingName,
        abn: c.abn,
        phone: c.phone,
        email: c.email,
        accountManagerName: managers.get(c.accountManagerId) ?? "",
        arName: ar?.fullName ?? "",
        arCompanyName: ar?.companyName ?? "",
      };
    }),
    policies: policiesPage.rows.map((p) => ({
      policyId: p.policyId,
      policyNumber: p.policyNumber,
      insuredName: p.insuredName,
      clientName: p.clientName,
      clientId: p.clientId,
      statusName: statuses.get(p.policyStatusId) ?? "—",
    })),
    clientTotal,
    policyTotal,
    total: clientTotal + policyTotal,
  };
}
