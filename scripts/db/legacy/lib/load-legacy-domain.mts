/**
 * Load legacy domain export payload into Postgres (+ optional R2 document upload).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";

import { getDb } from "../../../../app/lib/db/client";
import { policyToRows } from "../../../../app/lib/db/policy-mapper";
import {
  accountManager,
  authorisedRepresentative,
  client,
  policy,
  policyCar,
  policyCarAdjustment,
  policyCarSelectedWording,
  policyDocument,
  policyNote,
} from "../../../../app/lib/db/schema";
import type { PolicyDocument } from "../../../../app/lib/db/types";
import { accountManagerIdForCode } from "./legacy-account-manager-map.mts";
import {
  planLegacyPolicyDocuments,
  buildLegacyPolicyDocumentEntryFromRow,
  type LegacyDocumentPlanRow,
} from "./legacy-document-plan.mts";
import { resolvePolicyDocumentRoots } from "./legacy-document-path.mts";
import {
  filterPolicyDocumentsForTarget,
  loadPostgresLegacyDocumentR2Tails,
  loadTargetPolicyUuidSet,
} from "./legacy-document-target.mts";
import { clearLegacyDocuments } from "./clear-legacy-documents.mts";
import {
  assertSyncStateCompatible,
  DEFAULT_SYNC_STATE_PATH,
  emptySyncState,
  loadSyncState,
  markDocumentCompleted,
  markDocumentMissing,
  saveSyncState,
  syncStateSets,
  type LegacyDocumentSyncState,
} from "./legacy-document-sync-state.mts";
import { upsertLegacyPolicyDocumentInPostgres } from "./legacy-document-postgres.mts";
import {
  hasR2Credentials,
  policyDocumentsBucket,
  uploadPolicyDocumentToR2,
} from "./legacy-document-upload.mts";
import { legacyClientUuid, legacyPolicyUuid } from "./legacy-id-map.mts";
import {
  dedupeLegacyPolicyNumbers,
  legacyPolicyRowToPolicy,
} from "./legacy-policy-mapper.mts";
import { attachPolicySeriesFields } from "../../lib/policy-series-import.mts";
import { syncPolicyNumberSeqFromPolicies } from "../../lib/policy-number-seq.mts";
import {
  missingPolicyDocumentRow,
  planRowToMissingCsvRow,
  writeMissingPolicyDocumentsCsv,
  type MissingPolicyDocumentRow,
} from "./legacy-missing-documents-csv.mts";
import type {
  LegacyDomainPayload,
  LegacyDomainSlice,
  LegacyPolicyDocumentRow,
} from "./legacy-payload.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

export type LoadLegacyDomainOptions = {
  data: LegacyDomainPayload;
  only?: LegacyDomainSlice[];
  replace?: boolean;
  dryRun?: boolean;
  skipR2?: boolean;
  defaultArId?: number | null;
  documentRoot?: string;
  createdBy?: string;
  /** When set, write missing-on-disk documents to this CSV path. */
  missingDocumentsCsv?: string;
  /** Resume document migration from checkpoint (default true for documents slice). */
  resumeDocuments?: boolean;
  /** Wipe migrated documents + checkpoint before loading documents. */
  clearDocuments?: boolean;
  /** Path to document sync checkpoint JSON. */
  syncStatePath?: string;
  /** Target env label stored in checkpoint (local|uat|prod). */
  targetEnv?: string;
  /** Export snapshot path used for document clear + checkpoint metadata. */
  exportPath?: string;
};

const ALL_SLICES: LegacyDomainSlice[] = [
  "account-managers",
  "ar",
  "clients",
  "policies",
  "documents",
];

/** Default for `db:migrate:legacy` — Postgres only; documents/R2 is a separate command. */
export const DEFAULT_DB_SLICES: LegacyDomainSlice[] = [
  "account-managers",
  "ar",
  "clients",
  "policies",
];

function resolveSlices(only?: LegacyDomainSlice[]): LegacyDomainSlice[] {
  return only?.length ? only : DEFAULT_DB_SLICES;
}

function shouldRun(slice: LegacyDomainSlice, slices: LegacyDomainSlice[]) {
  return slices.includes(slice);
}

function logDocumentProgress(
  processed: number,
  total: number,
  copied: number,
  missing: number,
  uploadToR2: boolean,
) {
  const left = total - processed;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 100;
  const copiedLabel = uploadToR2 ? "uploaded" : "prepared";
  console.log(
    `  documents ${processed}/${total} (${left} left, ${pct}%) — ${copiedLabel} ${copied}, missing ${missing}`,
  );
}

function documentProgressInterval(total: number): number {
  if (total <= 50) return 1;
  if (total <= 500) return 10;
  if (total <= 5000) return 50;
  return 100;
}

const SYNC_STATE_SAVE_EVERY = 25;

function buildLegacyPolicyDocumentEntry(
  doc: LegacyPolicyDocumentRow,
  createdBy: string,
): PolicyDocument {
  return buildLegacyPolicyDocumentEntryFromRow(doc, createdBy);
}

function logLegacyDocumentPlanSummary(
  stats: {
    alreadyInR2: number;
    readyToUpload: number;
    missingLocal: number;
    total: number;
  },
  uploadToR2: boolean,
) {
  console.log("");
  console.log("Document plan (export vs local folder vs R2)");
  console.log(`  total in export:     ${stats.total}`);
  if (uploadToR2) {
    console.log(`  already in R2:       ${stats.alreadyInR2} (skip upload)`);
    console.log(
      `  ready to upload:     ${stats.readyToUpload} (local file, not in R2 yet)`,
    );
  } else {
    console.log(
      `  local file found:    ${stats.readyToUpload + stats.alreadyInR2}`,
    );
  }
  console.log(`  missing local file:  ${stats.missingLocal}`);
  console.log("");
}

function writeDocumentPlanCsv(
  path: string,
  planRows: LegacyDocumentPlanRow[],
  roots: string[],
): number {
  const missing = planRows.filter((row) => row.status === "missing_local");
  writeMissingPolicyDocumentsCsv(
    path,
    missing.map((row) => planRowToMissingCsvRow(row, roots)),
  );
  return missing.length;
}

async function scopeLegacyPolicyDocumentsForTarget(
  documents: LegacyPolicyDocumentRow[],
  documentsOnly: boolean,
) {
  if (!documentsOnly) {
    return { documents, skippedNotOnTarget: 0, postgresR2TailKeys: null };
  }
  const [targetPolicyUuids, postgresR2TailKeys] = await Promise.all([
    loadTargetPolicyUuidSet(),
    loadPostgresLegacyDocumentR2Tails(),
  ]);
  const { documents: scoped, skipped } = filterPolicyDocumentsForTarget(
    documents,
    targetPolicyUuids,
  );
  if (skipped > 0) {
    console.log(
      `  scoped to ${scoped.length} document row(s) for policies on target` +
        ` (${skipped} skipped — legacy policy term not loaded in Postgres)`,
    );
  }
  return {
    documents: scoped,
    skippedNotOnTarget: skipped,
    postgresR2TailKeys,
  };
}

function addDocumentToPolicyMap(
  map: Map<number, PolicyDocument[]>,
  doc: LegacyPolicyDocumentRow,
  entry: PolicyDocument,
) {
  const list = map.get(doc.policyId) ?? [];
  list.push(entry);
  map.set(doc.policyId, list);
}

async function persistDocumentMetadataOnly(
  entry: PolicyDocument,
  documentsOnly: boolean,
  dryRun: boolean | undefined,
  syncState: LegacyDocumentSyncState | null,
): Promise<boolean> {
  if (!documentsOnly || dryRun) return false;
  const updated = await upsertLegacyPolicyDocumentInPostgres(entry);
  if (updated && syncState) syncState.stats.postgresUpdated += 1;
  return updated;
}

async function resolveDefaultArId(explicit: number | null | undefined) {
  if (explicit != null && explicit > 0) return explicit;
  const db = getDb();
  const [first] = await db
    .select({
      id: authorisedRepresentative.authorisedRepresentativeId,
    })
    .from(authorisedRepresentative)
    .orderBy(authorisedRepresentative.authorisedRepresentativeId)
    .limit(1);
  if (!first) {
    throw new Error(
      "No authorised representatives in Postgres. Migrate AR first or pass --default-ar.",
    );
  }
  return first.id;
}

export async function loadLegacyDomain(options: LoadLegacyDomainOptions) {
  const createdBy = options.createdBy ?? "migrate:mssql";
  const slices = resolveSlices(options.only);
  const stats = {
    accountManagers: 0,
    authorisedRepresentatives: 0,
    clients: 0,
    policies: 0,
    documentsUploaded: 0,
    documentsCopied: 0,
    documentsMissing: 0,
    documentsAlreadyInR2: 0,
    documentsToUpload: 0,
    documentsSkipped: 0,
    missingDocumentsCsv: undefined as string | undefined,
  };

  if (options.dryRun) {
    if (shouldRun("account-managers", slices)) {
      stats.accountManagers = options.data.accountManagers.length;
    }
    if (shouldRun("ar", slices)) {
      stats.authorisedRepresentatives =
        options.data.authorisedRepresentatives.length;
    }
    if (shouldRun("clients", slices)) {
      stats.clients = options.data.clients.length;
    }
    if (shouldRun("policies", slices)) {
      stats.policies = options.data.policies.length;
    }
    if (shouldRun("documents", slices)) {
      const roots = resolvePolicyDocumentRoots(options.documentRoot);
      const uploadToR2 = !options.skipR2;
      const bucket =
        uploadToR2 && hasR2Credentials() ? policyDocumentsBucket() : null;
      const documentsOnly = !shouldRun("policies", slices);
      const scoped = await scopeLegacyPolicyDocumentsForTarget(
        options.data.policyDocuments,
        documentsOnly,
      );
      const plan = await planLegacyPolicyDocuments({
        documents: scoped.documents,
        roots,
        bucket,
        skipR2: options.skipR2 ?? false,
        postgresR2TailKeys: scoped.postgresR2TailKeys,
      });
      logLegacyDocumentPlanSummary(plan.stats, uploadToR2 && Boolean(bucket));
      stats.documentsAlreadyInR2 = plan.stats.alreadyInR2;
      stats.documentsToUpload = plan.stats.readyToUpload;
      stats.documentsMissing = plan.stats.missingLocal;
      stats.documentsCopied = plan.stats.readyToUpload + plan.stats.alreadyInR2;
      if (options.missingDocumentsCsv) {
        const missingCount = writeDocumentPlanCsv(
          options.missingDocumentsCsv,
          plan.rows,
          roots,
        );
        stats.missingDocumentsCsv = options.missingDocumentsCsv;
        console.log(
          `  wrote ${missingCount} missing row(s) to ${options.missingDocumentsCsv} (not in R2 and not on disk)`,
        );
      }
    }
    return stats;
  }

  const db = getDb();

  if (shouldRun("account-managers", slices)) {
    console.log(
      `Loading ${options.data.accountManagers.length} account managers…`,
    );
    if (options.replace) {
      await db.execute(
        sql`TRUNCATE TABLE account_manager RESTART IDENTITY CASCADE`,
      );
      // Re-seed the canonical 6 rows expected by existing clients.
      await db.execute(sql`
        INSERT INTO account_manager (account_manager_id, full_name, abbrev, email, ar_number, mobile, created_by)
        VALUES
          (1, 'Loretta Casey', 'Loretta', 'lcasey@irecon.com.au', 'Authorised Representative No. 1239170', '0499 221 761', ${createdBy}),
          (2, 'Justin Kinnear', 'Justin', 'jkinnear@irecon.com.au', 'Authorised Representative No. 1245239', '0452 646 764', ${createdBy}),
          (3, 'Lesley Connolly', 'Lesley', 'lconnolly@irecon.com.au', 'Authorised Representative No. 300468', '0405 684 083', ${createdBy}),
          (4, 'Renee Dennis', 'Renee', 'rdennis@irecon.com.au', 'Authorised Representative No. 1283254', '0450 774 880', ${createdBy}),
          (5, 'Robyn Vardy', 'Robyn', 'rvardy@irecon.com.au', 'Authorised Representative No. 1233987', '0452 646 764', ${createdBy}),
          (6, 'Tracey Ferraro', 'Tracey', 'admin@irecon.com.au', 'On behalf of Lesley Connolly', '', ${createdBy})
        ON CONFLICT (account_manager_id) DO NOTHING
      `);
    }

    const deduped = new Map<
      number,
      (typeof options.data.accountManagers)[number]
    >();
    for (const row of options.data.accountManagers) {
      const id = accountManagerIdForCode(row.code);
      if (!deduped.has(id) || row.code === ".NA") {
        deduped.set(id, row);
      }
    }
    const rows = [...deduped.values()];

    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await db
        .insert(accountManager)
        .values(
          chunk.map((row) => ({
            accountManagerId: accountManagerIdForCode(row.code),
            fullName: row.fullName,
            abbrev: row.abbrev,
            email: row.email,
            arNumber: row.arNumber,
            mobile: row.mobile,
            createdBy,
          })),
        )
        .onConflictDoUpdate({
          target: accountManager.accountManagerId,
          set: {
            fullName: sql`excluded.full_name`,
            abbrev: sql`excluded.abbrev`,
            email: sql`excluded.email`,
            arNumber: sql`excluded.ar_number`,
            mobile: sql`excluded.mobile`,
          },
        });
    }
    stats.accountManagers = options.data.accountManagers.length;
  }

  if (shouldRun("ar", slices)) {
    console.log(
      `Loading ${options.data.authorisedRepresentatives.length} authorised representatives…`,
    );
    if (options.replace) {
      await db.execute(
        sql`TRUNCATE TABLE authorised_representative RESTART IDENTITY CASCADE`,
      );
    }
    const chunkSize = 100;
    for (
      let i = 0;
      i < options.data.authorisedRepresentatives.length;
      i += chunkSize
    ) {
      const chunk = options.data.authorisedRepresentatives.slice(
        i,
        i + chunkSize,
      );
      await db.insert(authorisedRepresentative).values(
        chunk.map((row) => ({
          authorisedRepresentativeId: row.authorisedRepresentativeId,
          fullName: row.fullName,
          companyName: row.companyName,
          arNumber: row.arNumber,
          mobilePhone: row.mobilePhone,
          businessPhone: row.businessPhone,
          email: row.email,
          ownBroker: row.ownBroker,
          createdBy,
        })),
      );
    }
    await db.execute(sql`
      SELECT setval(
        pg_get_serial_sequence('authorised_representative', 'authorised_representative_id'),
        (SELECT COALESCE(MAX(authorised_representative_id), 1) FROM authorised_representative)
      )
    `);
    stats.authorisedRepresentatives =
      options.data.authorisedRepresentatives.length;
  }

  const defaultArId = await resolveDefaultArId(options.defaultArId);
  const arIds = new Set(
    options.data.authorisedRepresentatives.map(
      (row) => row.authorisedRepresentativeId,
    ),
  );

  if (shouldRun("clients", slices)) {
    console.log(`Loading ${options.data.clients.length} clients…`);
    if (options.replace) {
      await db.execute(sql`TRUNCATE TABLE client RESTART IDENTITY CASCADE`);
    }
    const chunkSize = 100;
    for (let i = 0; i < options.data.clients.length; i += chunkSize) {
      const chunk = options.data.clients.slice(i, i + chunkSize);
      await db.insert(client).values(
        chunk.map((row) => ({
          clientId: legacyClientUuid(row.clientId),
          name: row.name,
          tradingName: row.tradingName || row.name,
          abn: row.abn,
          phone: row.phone,
          email: row.email,
          accountManagerId: accountManagerIdForCode(row.accountManagerCode),
          clientSourceId: row.clientSourceId,
          authorisedRepresentativeId:
            row.authorisedRepresentativeId != null &&
            arIds.has(row.authorisedRepresentativeId)
              ? row.authorisedRepresentativeId
              : defaultArId,
          createdWhen: row.createdWhen ? new Date(row.createdWhen) : new Date(),
          createdBy,
        })),
      );
    }
    stats.clients = options.data.clients.length;
  }

  const policyDocumentsByLegacyId = new Map<number, PolicyDocument[]>();

  if (shouldRun("documents", slices)) {
    const uploadToR2 = !options.skipR2;
    const documentsOnly = !shouldRun("policies", slices);
    const resumeDocuments = options.resumeDocuments ?? true;
    const syncStatePath = options.syncStatePath ?? DEFAULT_SYNC_STATE_PATH;
    const exportPath =
      options.exportPath ?? join(repoRoot, "_archive/data/legacy-export.json");

    let syncState: LegacyDocumentSyncState | null = null;
    let completedIds = new Set<number>();
    let missingIds = new Set<number>();

    if (options.clearDocuments) {
      console.log("Clearing migrated legacy documents…");
      const cleared = await clearLegacyDocuments({
        exportPath,
        payload: options.data,
        dryRun: options.dryRun,
        skipR2: options.skipR2,
        syncStatePath,
      });
      console.log(
        `  cleared ${cleared.legacyDocumentsRemoved} legacy document(s) on ${cleared.policiesCleared} polic(y/ies)` +
          (uploadToR2 ? `, ${cleared.r2KeysRemoved} R2 object(s)` : "") +
          (cleared.syncStateCleared ? ", checkpoint reset" : ""),
      );
      completedIds = new Set<number>();
      missingIds = new Set<number>();
      syncState = null;
    }

    if (uploadToR2 && !hasR2Credentials()) {
      throw new Error(
        "R2 credentials missing (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT). Pass --skip-r2 to load metadata only.",
      );
    }
    const roots = resolvePolicyDocumentRoots(options.documentRoot);
    const bucket = uploadToR2 ? policyDocumentsBucket() : null;
    const scoped = await scopeLegacyPolicyDocumentsForTarget(
      options.data.policyDocuments,
      documentsOnly,
    );
    console.log(
      `Processing ${scoped.documents.length} policy documents from ${roots.join(", ")}…`,
    );
    if (uploadToR2) {
      console.log(`  R2 bucket: ${bucket}`);
    }

    const documentPlan = await planLegacyPolicyDocuments({
      documents: scoped.documents,
      roots,
      bucket,
      skipR2: options.skipR2 ?? false,
      postgresR2TailKeys: scoped.postgresR2TailKeys,
    });
    logLegacyDocumentPlanSummary(
      documentPlan.stats,
      uploadToR2 && Boolean(bucket),
    );
    const planByDocumentId = new Map(
      documentPlan.rows.map((row) => [row.policyDocumentId, row]),
    );

    if (resumeDocuments && options.targetEnv && !options.clearDocuments) {
      syncState = loadSyncState(syncStatePath);
      if (syncState) {
        assertSyncStateCompatible(syncState, {
          env: options.targetEnv,
          exportPath,
          exportExportedAt: options.data.meta.exportedAt,
        });
        ({ completed: completedIds, missing: missingIds } =
          syncStateSets(syncState));
        console.log(
          `  resuming checkpoint — ${completedIds.size} uploaded, ${missingIds.size} missing`,
        );
      }
    }

    if (!syncState && options.targetEnv && !options.dryRun) {
      syncState = emptySyncState({
        env: options.targetEnv,
        exportPath,
        exportExportedAt: options.data.meta.exportedAt,
      });
    }

    const totalDocuments = scoped.documents.length;
    const progressEvery = documentProgressInterval(totalDocuments);
    let processed = 0;
    let processedSinceSave = 0;
    const missingDocuments: MissingPolicyDocumentRow[] = [];

    for (const doc of scoped.documents) {
      processed += 1;

      if (completedIds.has(doc.policyDocumentId)) {
        stats.documentsSkipped += 1;
        const entry = buildLegacyPolicyDocumentEntry(doc, createdBy);
        addDocumentToPolicyMap(policyDocumentsByLegacyId, doc, entry);
        // Checkpoint skips R2 re-upload, but Postgres may have been wiped
        // (e.g. db:migrate:legacy:local --replace) — still upsert metadata.
        if (
          await persistDocumentMetadataOnly(
            entry,
            documentsOnly,
            options.dryRun,
            syncState,
          )
        ) {
          stats.documentsCopied += 1;
        }
        if (
          processed === 1 ||
          processed === totalDocuments ||
          processed % progressEvery === 0
        ) {
          logDocumentProgress(
            processed,
            totalDocuments,
            stats.documentsCopied,
            stats.documentsMissing,
            uploadToR2,
          );
        }
        continue;
      }

      const planned = planByDocumentId.get(doc.policyDocumentId);

      if (missingIds.has(doc.policyDocumentId)) {
        if (planned?.status === "already_in_r2") {
          stats.documentsAlreadyInR2 += 1;
          stats.documentsSkipped += 1;
          const entry = buildLegacyPolicyDocumentEntry(doc, createdBy);
          addDocumentToPolicyMap(policyDocumentsByLegacyId, doc, entry);
          await persistDocumentMetadataOnly(
            entry,
            documentsOnly,
            options.dryRun,
            syncState,
          );
          completedIds.add(doc.policyDocumentId);
          if (syncState) {
            markDocumentCompleted(syncState, doc.policyDocumentId);
            missingIds.delete(doc.policyDocumentId);
            processedSinceSave += 1;
          }
          if (
            processed === 1 ||
            processed === totalDocuments ||
            processed % progressEvery === 0
          ) {
            logDocumentProgress(
              processed,
              totalDocuments,
              stats.documentsCopied,
              stats.documentsMissing,
              uploadToR2,
            );
          }
          continue;
        }

        stats.documentsMissing += 1;
        missingDocuments.push(missingPolicyDocumentRow(roots, doc));
        if (
          processed === 1 ||
          processed === totalDocuments ||
          processed % progressEvery === 0
        ) {
          logDocumentProgress(
            processed,
            totalDocuments,
            stats.documentsCopied,
            stats.documentsMissing,
            uploadToR2,
          );
        }
        continue;
      }

      const entry = buildLegacyPolicyDocumentEntry(doc, createdBy);

      if (planned?.status === "already_in_r2") {
        stats.documentsAlreadyInR2 += 1;
        stats.documentsSkipped += 1;
        addDocumentToPolicyMap(policyDocumentsByLegacyId, doc, entry);
        await persistDocumentMetadataOnly(
          entry,
          documentsOnly,
          options.dryRun,
          syncState,
        );
        completedIds.add(doc.policyDocumentId);
        if (syncState) {
          markDocumentCompleted(syncState, doc.policyDocumentId);
          processedSinceSave += 1;
        }
        if (
          processed === 1 ||
          processed === totalDocuments ||
          processed % progressEvery === 0
        ) {
          logDocumentProgress(
            processed,
            totalDocuments,
            stats.documentsCopied,
            stats.documentsMissing,
            uploadToR2,
          );
        }
        continue;
      }

      const localPath = planned?.localPath || null;
      if (!localPath) {
        stats.documentsMissing += 1;
        missingDocuments.push(missingPolicyDocumentRow(roots, doc));
        missingIds.add(doc.policyDocumentId);
        if (syncState) {
          markDocumentMissing(syncState, doc.policyDocumentId);
          processedSinceSave += 1;
        }
        if (
          processed === 1 ||
          processed === totalDocuments ||
          processed % progressEvery === 0
        ) {
          logDocumentProgress(
            processed,
            totalDocuments,
            stats.documentsCopied,
            stats.documentsMissing,
            uploadToR2,
          );
        }
        continue;
      }

      if (uploadToR2) {
        await uploadPolicyDocumentToR2({ localPath, r2Key: entry.r2Key! });
        stats.documentsUploaded += 1;
        stats.documentsToUpload += 1;
      }
      stats.documentsCopied += 1;
      addDocumentToPolicyMap(policyDocumentsByLegacyId, doc, entry);

      await persistDocumentMetadataOnly(
        entry,
        documentsOnly,
        options.dryRun,
        syncState,
      );

      completedIds.add(doc.policyDocumentId);
      if (syncState) {
        markDocumentCompleted(syncState, doc.policyDocumentId);
        processedSinceSave += 1;
      }

      if (
        syncState &&
        processedSinceSave >= SYNC_STATE_SAVE_EVERY &&
        !options.dryRun
      ) {
        saveSyncState(syncState, syncStatePath);
        processedSinceSave = 0;
      }

      if (
        processed === 1 ||
        processed === totalDocuments ||
        processed % progressEvery === 0
      ) {
        logDocumentProgress(
          processed,
          totalDocuments,
          stats.documentsCopied,
          stats.documentsMissing,
          uploadToR2,
        );
      }
    }

    const copiedLabel = uploadToR2 ? "uploaded" : "prepared";
    const copiedCount = uploadToR2
      ? stats.documentsUploaded
      : stats.documentsCopied;
    console.log(
      `  documents done — ${copiedLabel} ${copiedCount}, missing ${stats.documentsMissing}` +
        (stats.documentsSkipped > 0
          ? `, skipped ${stats.documentsSkipped} (checkpoint)`
          : ""),
    );

    if (syncState && !options.dryRun) {
      saveSyncState(syncState, syncStatePath);
      console.log(`  checkpoint saved ${syncStatePath}`);
    }

    if (options.missingDocumentsCsv) {
      const missingCount = writeDocumentPlanCsv(
        options.missingDocumentsCsv,
        documentPlan.rows,
        roots,
      );
      stats.missingDocumentsCsv = options.missingDocumentsCsv;
      console.log(
        `  wrote ${missingCount} missing row(s) to ${options.missingDocumentsCsv} (not in R2 and not on disk)`,
      );
    }
  }

  if (shouldRun("policies", slices)) {
    const { rows: policyRows, suffixed: policyNumbersSuffixed } =
      dedupeLegacyPolicyNumbers(options.data.policies);
    console.log(`Loading ${policyRows.length} policies…`);
    if (policyNumbersSuffixed > 0) {
      console.log(
        `  allocated ${policyNumbersSuffixed} renewal policy number(s) (series term #1, #2, …)`,
      );
    }
    if (options.replace) {
      await db.execute(sql`
        TRUNCATE TABLE
          policy_car_selected_wording,
          policy_note,
          policy_document,
          policy_car_adjustment,
          policy_car,
          policy,
          policy_series
        RESTART IDENTITY CASCADE
      `);
    }

    const chunkSize = 25;
    for (let i = 0; i < policyRows.length; i += chunkSize) {
      const chunk = policyRows.slice(i, i + chunkSize);
      const chunkPolicyDocs = chunk.map((row) => {
        const policyDoc = legacyPolicyRowToPolicy(row);
        const docs = policyDocumentsByLegacyId.get(row.policyId);
        if (docs?.length) {
          policyDoc.documents = docs;
        }
        return { row, policyDoc };
      });
      const enrichedPolicies = await attachPolicySeriesFields(
        chunkPolicyDocs.map(({ row, policyDoc }) => ({
          clientId: policyDoc.clientId,
          policyNumber: policyDoc.policyNumber,
          seriesNumber: row.seriesNumber,
          createdBy: policyDoc.createdBy,
          createdWhen: policyDoc.createdWhen,
        })),
      );
      for (let j = 0; j < chunkPolicyDocs.length; j++) {
        const { row, policyDoc } = chunkPolicyDocs[j]!;
        const series = enrichedPolicies[j]!;
        const policyDocWithSeries = {
          ...policyDoc,
          policySeriesId: series.policySeriesId,
          seriesNumber: series.seriesNumber,
          seriesTerm: row.seriesTerm ?? 0,
        };
        const {
          policyValues,
          carValues,
          adjustmentValues,
          documentValues,
          noteValues,
          selectedWordingIds,
        } = policyToRows(policyDocWithSeries);
        await db.insert(policy).values({
          ...policyValues,
          createdBy,
        });
        await db.insert(policyCar).values({
          ...carValues,
          manualTaxOverride: row.manualTaxOverride ?? false,
        });
        if (adjustmentValues) {
          await db.insert(policyCarAdjustment).values(adjustmentValues);
        }
        if (documentValues.length > 0) {
          await db.insert(policyDocument).values(documentValues);
        }
        if (noteValues.length > 0) {
          await db.insert(policyNote).values(noteValues);
        }
        if (selectedWordingIds.length > 0) {
          await db.insert(policyCarSelectedWording).values(
            selectedWordingIds.map((carWordingId) => ({
              policyId: policyDocWithSeries.policyId,
              carWordingId,
            })),
          );
        }
      }
      if ((i + chunkSize) % 500 === 0 || i + chunkSize >= policyRows.length) {
        console.log(
          `  … ${Math.min(i + chunkSize, policyRows.length)} / ${policyRows.length}`,
        );
      }
    }
    stats.policies = policyRows.length;
    if (!options.dryRun) {
      await syncPolicyNumberSeqFromPolicies(db);
      console.log("  synced policy_number_seq from policy rows");
    }
  }

  return stats;
}

export function parseOnlySlices(
  raw: string | undefined,
): LegacyDomainSlice[] | undefined {
  if (!raw?.trim()) return undefined;
  const slices = raw.split(",").map((s) => s.trim()) as LegacyDomainSlice[];
  const valid = new Set(ALL_SLICES);
  for (const slice of slices) {
    if (!valid.has(slice)) {
      throw new Error(`Unknown --only slice: ${slice}`);
    }
  }
  return slices;
}
