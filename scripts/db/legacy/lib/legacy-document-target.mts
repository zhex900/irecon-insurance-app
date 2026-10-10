/**
 * Scope legacy document migrate to policies that exist on the target Postgres DB.
 */
import { like } from "drizzle-orm";

import { getDb } from "../../../../app/lib/db/client";
import { policy, policyDocument } from "../../../../app/lib/db/schema";
import { buildLegacyDocumentR2TailIndex } from "./legacy-document-r2.mts";
import { legacyPolicyUuid } from "./legacy-id-map.mts";
import type { LegacyPolicyDocumentRow } from "./legacy-payload.ts";

export async function loadTargetPolicyUuidSet(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db.select({ policyId: policy.policyId }).from(policy);
  return new Set(rows.map((row) => row.policyId));
}

/** R2 object tails (`{legacyDocId}-{filename}`) already recorded on target. */
export async function loadPostgresLegacyDocumentR2Tails(): Promise<
  Set<string>
> {
  const db = getDb();
  const rows = await db
    .select({ r2Key: policyDocument.r2Key })
    .from(policyDocument)
    .where(like(policyDocument.generationKey, "legacy:%"));

  const keys = rows
    .map((row) => row.r2Key?.trim())
    .filter((key): key is string => Boolean(key));
  return buildLegacyDocumentR2TailIndex(keys);
}

export function filterPolicyDocumentsForTarget(
  documents: LegacyPolicyDocumentRow[],
  targetPolicyUuids: Set<string>,
): { documents: LegacyPolicyDocumentRow[]; skipped: number } {
  if (targetPolicyUuids.size === 0) {
    return { documents, skipped: 0 };
  }
  const scoped = documents.filter((doc) =>
    targetPolicyUuids.has(legacyPolicyUuid(doc.policyId)),
  );
  return {
    documents: scoped,
    skipped: documents.length - scoped.length,
  };
}
