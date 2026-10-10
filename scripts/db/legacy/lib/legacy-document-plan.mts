/**
 * Classify legacy policy documents for incremental R2 backfill.
 */
import type { PolicyDocument } from "../../../../app/lib/db/types";
import {
  createLegacyDocumentLookupContext,
  resolveLegacyPolicyDocumentFile,
  type LegacyDocumentLookupContext,
} from "./legacy-document-path.mts";
import {
  buildLegacyDocumentR2TailIndex,
  isLegacyDocumentInR2,
  listR2ObjectKeys,
} from "./legacy-document-r2.mts";
import {
  legacyPolicyDocumentUuid,
  legacyPolicyUuid,
  policyDocumentR2Key,
} from "./legacy-id-map.mts";
import type { LegacyPolicyDocumentRow } from "./legacy-payload.ts";

export type LegacyDocumentPlanStatus =
  "already_in_r2" | "ready_to_upload" | "missing_local";

export type LegacyDocumentPlanRow = {
  policyDocumentId: number;
  policyId: number;
  policyNumber: string;
  documentTypeCode: string;
  documentName: string;
  filename: string;
  r2Key: string;
  status: LegacyDocumentPlanStatus;
  localPath: string;
};

export type LegacyDocumentPlanStats = {
  total: number;
  alreadyInR2: number;
  readyToUpload: number;
  missingLocal: number;
};

export function legacyDocumentR2Key(doc: LegacyPolicyDocumentRow): string {
  const policyUuid = legacyPolicyUuid(doc.policyId);
  return policyDocumentR2Key(policyUuid, doc.policyDocumentId, doc.filename);
}

export function classifyLegacyPolicyDocument(
  doc: LegacyPolicyDocumentRow,
  lookup: LegacyDocumentLookupContext,
  r2Keys: Set<string> | null,
  r2TailKeys: Set<string> | null,
): LegacyDocumentPlanRow {
  const r2Key = legacyDocumentR2Key(doc);
  const localPath = resolveLegacyPolicyDocumentFile(lookup, doc) ?? "";
  const inR2 =
    r2Keys && r2TailKeys
      ? isLegacyDocumentInR2(r2Key, doc, r2Keys, r2TailKeys)
      : false;
  const hasLocal = Boolean(localPath);

  let status: LegacyDocumentPlanStatus;
  if (hasLocal && !inR2) {
    status = "ready_to_upload";
  } else if (inR2) {
    status = "already_in_r2";
  } else {
    status = "missing_local";
  }

  return {
    policyDocumentId: doc.policyDocumentId,
    policyId: doc.policyId,
    policyNumber: doc.policyNumber,
    documentTypeCode: doc.documentTypeCode,
    documentName: doc.documentName,
    filename: doc.filename,
    r2Key,
    status,
    localPath,
  };
}

export function summarizeLegacyDocumentPlan(
  rows: LegacyDocumentPlanRow[],
): LegacyDocumentPlanStats {
  let alreadyInR2 = 0;
  let readyToUpload = 0;
  let missingLocal = 0;
  for (const row of rows) {
    if (row.status === "already_in_r2") alreadyInR2 += 1;
    else if (row.status === "ready_to_upload") readyToUpload += 1;
    else missingLocal += 1;
  }
  return {
    total: rows.length,
    alreadyInR2,
    readyToUpload,
    missingLocal,
  };
}

function mergeTailIndexes(
  ...sets: Array<Set<string> | null | undefined>
): Set<string> | null {
  const merged = new Set<string>();
  let any = false;
  for (const set of sets) {
    if (!set) continue;
    any = true;
    for (const value of set) merged.add(value);
  }
  return any ? merged : null;
}

export async function planLegacyPolicyDocuments(options: {
  documents: LegacyPolicyDocumentRow[];
  roots: string[];
  bucket: string | null;
  skipR2: boolean;
  /** Extra `{legacyDocId}-{filename}` tails from target Postgres `policy_document`. */
  postgresR2TailKeys?: Set<string> | null;
}): Promise<{
  lookup: LegacyDocumentLookupContext;
  r2Keys: Set<string> | null;
  r2TailKeys: Set<string> | null;
  rows: LegacyDocumentPlanRow[];
  stats: LegacyDocumentPlanStats;
}> {
  const lookup = createLegacyDocumentLookupContext(options.roots);
  let r2Keys: Set<string> | null = null;
  let r2TailKeys: Set<string> | null = null;
  if (!options.skipR2 && options.bucket) {
    console.log(`  listing R2 keys in ${options.bucket}/policies/ …`);
    r2Keys = listR2ObjectKeys(options.bucket, "policies/");
    r2TailKeys = buildLegacyDocumentR2TailIndex(r2Keys);
    console.log(`  found ${r2Keys.size} object(s) in R2`);
  }
  r2TailKeys = mergeTailIndexes(r2TailKeys, options.postgresR2TailKeys);

  const rows = options.documents.map((doc) =>
    classifyLegacyPolicyDocument(doc, lookup, r2Keys, r2TailKeys),
  );
  return {
    lookup,
    r2Keys,
    r2TailKeys,
    rows,
    stats: summarizeLegacyDocumentPlan(rows),
  };
}

export function buildLegacyPolicyDocumentEntryFromRow(
  doc: LegacyPolicyDocumentRow,
  createdBy: string,
): PolicyDocument {
  const policyUuid = legacyPolicyUuid(doc.policyId);
  const r2Key = policyDocumentR2Key(
    policyUuid,
    doc.policyDocumentId,
    doc.filename,
  );
  return {
    documentId: legacyPolicyDocumentUuid(doc.policyDocumentId),
    policyId: policyUuid,
    name: doc.documentName,
    filename: doc.filename,
    generationKey: `legacy:${doc.policyDocumentId}`,
    content: "",
    generatedWhen: doc.generatedWhen ?? new Date().toISOString(),
    generatedBy: createdBy,
    documentTypeCode: doc.documentTypeCode,
    r2Key,
  };
}
