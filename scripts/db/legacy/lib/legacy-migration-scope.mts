import type { LegacyDomainPayload } from "./legacy-payload.ts";

/** Keep in sync with scripts/db/legacy/sql/_target-scope.sql */
export const LEGACY_TARGET_POLICY_STATUS_IDS = [1, 2] as const;

export function logMigrationScopeCounts(payload: LegacyDomainPayload): void {
  const policyClientIds = new Set(payload.policies.map((p) => p.clientId));
  const clientIds = new Set(payload.clients.map((c) => c.clientId));
  const orphanClients = [...clientIds].filter((id) => !policyClientIds.has(id));
  const policyIds = new Set(payload.policies.map((p) => p.policyId));
  const orphanDocs = payload.policyDocuments.filter(
    (d) => !policyIds.has(d.policyId),
  );

  console.log("");
  console.log("Target migration scope");
  console.log(
    `  filter: CAR policies with Status in (${LEGACY_TARGET_POLICY_STATUS_IDS.join(", ")}) — Pending, Taken`,
  );
  console.log(`  policies:         ${payload.policies.length}`);
  console.log(`  clients:          ${payload.clients.length}`);
  console.log(
    `  policyDocuments:  ${payload.policyDocuments.length} (R2: use db:migrate:legacy:documents:*)`,
  );
  console.log(
    `  accountManagers:  ${payload.accountManagers.length}  ar: ${payload.authorisedRepresentatives.length}`,
  );
  if (orphanClients.length > 0) {
    console.warn(
      `  warning: ${orphanClients.length} exported client(s) have no in-scope policy`,
    );
  }
  if (orphanDocs.length > 0) {
    console.warn(
      `  warning: ${orphanDocs.length} document row(s) reference out-of-scope policies`,
    );
  }
  console.log("");
}
