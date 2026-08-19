/**
 * Remove migrated legacy policy documents from Postgres and R2.
 */
import { existsSync, readFileSync } from "node:fs";

import { getDb } from "../../app/lib/db/client";
import { policyCar } from "../../app/lib/db/schema";
import type { PolicyDocument } from "../../app/lib/db/types";
import { eq } from "drizzle-orm";
import {
  clearSyncStateFile,
  DEFAULT_SYNC_STATE_PATH,
} from "./legacy-document-sync-state.mts";
import {
  deletePolicyDocumentsFromR2,
  hasR2Credentials,
  policyDocumentsBucketsForClear,
} from "./legacy-document-upload.mts";
import { legacyPolicyUuid, policyDocumentR2Key } from "./legacy-id-map.mts";
import type { LegacyDomainPayload } from "./legacy-payload.ts";

export type ClearLegacyDocumentsOptions = {
  exportPath?: string;
  payload?: LegacyDomainPayload;
  dryRun?: boolean;
  skipR2?: boolean;
  syncStatePath?: string;
};

export type ClearLegacyDocumentsSummary = {
  policiesCleared: number;
  legacyDocumentsRemoved: number;
  r2KeysRemoved: number;
  syncStateCleared: boolean;
};

function isLegacyMigratedDocument(doc: PolicyDocument): boolean {
  return doc.generationKey?.startsWith("legacy:") ?? false;
}

function loadExportPayload(
  exportPath: string | undefined,
  payload: LegacyDomainPayload | undefined,
): LegacyDomainPayload {
  if (payload) return payload;
  if (!exportPath || !existsSync(exportPath)) {
    throw new Error(
      "Export snapshot required to clear legacy documents. Pass --file or run after --write-json.",
    );
  }
  return JSON.parse(readFileSync(exportPath, "utf8")) as LegacyDomainPayload;
}

function r2KeysFromExport(payload: LegacyDomainPayload): string[] {
  return payload.policyDocuments.map((doc) =>
    policyDocumentR2Key(
      legacyPolicyUuid(doc.policyId),
      doc.policyDocumentId,
      doc.filename,
    ),
  );
}

export async function clearLegacyDocuments(
  options: ClearLegacyDocumentsOptions,
): Promise<ClearLegacyDocumentsSummary> {
  const syncStatePath = options.syncStatePath ?? DEFAULT_SYNC_STATE_PATH;
  const payload = loadExportPayload(options.exportPath, options.payload);
  const r2Keys = r2KeysFromExport(payload);

  const db = getDb();
  const rows = await db
    .select({
      policyId: policyCar.policyId,
      appExtras: policyCar.appExtras,
    })
    .from(policyCar);

  let policiesCleared = 0;
  let legacyDocumentsRemoved = 0;

  for (const row of rows) {
    const documents = row.appExtras?.documents ?? [];
    const legacyDocs = documents.filter(isLegacyMigratedDocument);
    if (legacyDocs.length === 0) continue;

    legacyDocumentsRemoved += legacyDocs.length;
    policiesCleared += 1;

    if (options.dryRun) continue;

    const remaining = documents.filter((doc) => !isLegacyMigratedDocument(doc));
    const nextExtras = { ...(row.appExtras ?? {}) };
    if (remaining.length > 0) {
      nextExtras.documents = remaining;
    } else {
      delete nextExtras.documents;
    }

    await db
      .update(policyCar)
      .set({ appExtras: nextExtras })
      .where(eq(policyCar.policyId, row.policyId));
  }

  let r2KeysRemoved = 0;
  if (!options.skipR2 && r2Keys.length > 0) {
    if (!hasR2Credentials()) {
      throw new Error(
        "R2 credentials missing (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT). Pass --skip-r2 to clear Postgres only.",
      );
    }
    if (options.dryRun) {
      r2KeysRemoved = r2Keys.length;
    } else {
      const buckets = policyDocumentsBucketsForClear();
      console.log(
        `Removing ${r2Keys.length} object(s) from R2 (${buckets.join(", ")})…`,
      );
      r2KeysRemoved = await deletePolicyDocumentsFromR2(r2Keys, buckets);
    }
  }

  let syncStateCleared = false;
  if (!options.dryRun) {
    syncStateCleared = clearSyncStateFile(syncStatePath);
  } else if (existsSync(syncStatePath)) {
    syncStateCleared = true;
  }

  return {
    policiesCleared,
    legacyDocumentsRemoved,
    r2KeysRemoved,
    syncStateCleared,
  };
}
