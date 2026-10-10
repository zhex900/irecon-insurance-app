/**
 * Upsert legacy policy_document rows (metadata + r2_key) without uploading bytes.
 */
import { eq } from "drizzle-orm";

import { getDb } from "../../../../app/lib/db/client";
import { policyCar, policyDocument } from "../../../../app/lib/db/schema";
import type { PolicyDocument } from "../../../../app/lib/db/types";

export async function upsertLegacyPolicyDocumentInPostgres(
  entry: PolicyDocument,
): Promise<boolean> {
  const db = getDb();
  const [existing] = await db
    .select({ policyId: policyCar.policyId })
    .from(policyCar)
    .where(eq(policyCar.policyId, entry.policyId))
    .limit(1);
  if (!existing) return false;

  await db
    .insert(policyDocument)
    .values({
      documentId: entry.documentId!,
      policyId: entry.policyId,
      name: entry.name,
      filename: entry.filename,
      generationKey: entry.generationKey,
      content: entry.templateKey ? "" : entry.content,
      templateKey: entry.templateKey ?? null,
      libraryDocumentId: entry.libraryDocumentId ?? null,
      generatedWhen: new Date(entry.generatedWhen),
      generatedBy: entry.generatedBy,
      documentTypeCode: entry.documentTypeCode ?? null,
      r2Key: entry.r2Key ?? null,
    })
    .onConflictDoUpdate({
      target: policyDocument.documentId,
      set: {
        name: entry.name,
        filename: entry.filename,
        generationKey: entry.generationKey,
        content: entry.templateKey ? "" : entry.content,
        templateKey: entry.templateKey ?? null,
        libraryDocumentId: entry.libraryDocumentId ?? null,
        generatedWhen: new Date(entry.generatedWhen),
        generatedBy: entry.generatedBy,
        documentTypeCode: entry.documentTypeCode ?? null,
        r2Key: entry.r2Key ?? null,
      },
    });
  return true;
}
