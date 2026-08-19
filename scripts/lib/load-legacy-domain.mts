/**
 * Load legacy domain export payload into Postgres (+ optional R2 document upload).
 */
import { sql, eq } from "drizzle-orm";

import { getDb } from "../../app/lib/db/client";
import { policyToRows } from "../../app/lib/db/policy-mapper";
import {
  accountManager,
  authorisedRepresentative,
  client,
  policy,
  policyCar,
  policyCarAdjustment,
} from "../../app/lib/db/schema";
import type { PolicyDocument } from "../../app/lib/db/types";
import { accountManagerIdForCode } from "./legacy-account-manager-map.mts";
import {
  resolveLegacyDocumentFile,
  resolvePolicyDocumentRoots,
} from "./legacy-document-path.mts";
import {
  hasR2Credentials,
  policyDocumentsBucket,
  uploadPolicyDocumentToR2,
} from "./legacy-document-upload.mts";
import {
  legacyClientUuid,
  legacyPolicyUuid,
  policyDocumentR2Key,
} from "./legacy-id-map.mts";
import {
  dedupeLegacyPolicyNumbers,
  legacyPolicyRowToPolicy,
} from "./legacy-policy-mapper.mts";
import {
  missingPolicyDocumentRow,
  writeMissingPolicyDocumentsCsv,
  type MissingPolicyDocumentRow,
} from "./legacy-missing-documents-csv.mts";
import type {
  LegacyDomainPayload,
  LegacyDomainSlice,
} from "./legacy-payload.ts";

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
};

const ALL_SLICES: LegacyDomainSlice[] = [
  "account-managers",
  "ar",
  "clients",
  "policies",
  "documents",
];

function shouldRun(slice: LegacyDomainSlice, only?: LegacyDomainSlice[]) {
  return !only?.length || only.includes(slice);
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
  const slices = options.only?.length ? options.only : ALL_SLICES;
  const stats = {
    accountManagers: 0,
    authorisedRepresentatives: 0,
    clients: 0,
    policies: 0,
    documentsUploaded: 0,
    documentsCopied: 0,
    documentsMissing: 0,
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
      if (options.missingDocumentsCsv) {
        const roots = resolvePolicyDocumentRoots(options.documentRoot);
        const missing: MissingPolicyDocumentRow[] = [];
        for (const doc of options.data.policyDocuments) {
          if (!resolveLegacyDocumentFile(roots, doc.filename)) {
            missing.push(missingPolicyDocumentRow(roots, doc));
          }
        }
        writeMissingPolicyDocumentsCsv(options.missingDocumentsCsv, missing);
        stats.documentsMissing = missing.length;
        stats.documentsCopied =
          options.data.policyDocuments.length - missing.length;
        stats.missingDocumentsCsv = options.missingDocumentsCsv;
        console.log(
          `  wrote ${missing.length} missing document(s) to ${options.missingDocumentsCsv}`,
        );
      } else {
        stats.documentsSkipped = options.data.policyDocuments.length;
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
    if (uploadToR2 && !hasR2Credentials()) {
      throw new Error(
        "R2 credentials missing (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT). Pass --skip-r2 to load metadata only.",
      );
    }
    const roots = resolvePolicyDocumentRoots(options.documentRoot);
    console.log(
      `Processing ${options.data.policyDocuments.length} policy documents from ${roots.join(", ")}…`,
    );
    if (uploadToR2) {
      console.log(`  R2 bucket: ${policyDocumentsBucket()}`);
    }

    const totalDocuments = options.data.policyDocuments.length;
    const progressEvery = documentProgressInterval(totalDocuments);
    let processed = 0;
    const missingDocuments: MissingPolicyDocumentRow[] = [];

    for (const doc of options.data.policyDocuments) {
      processed += 1;
      const policyUuid = legacyPolicyUuid(doc.policyId);
      const localPath = resolveLegacyDocumentFile(roots, doc.filename);
      if (!localPath) {
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

      const r2Key = policyDocumentR2Key(
        policyUuid,
        doc.policyDocumentId,
        doc.filename,
      );
      if (uploadToR2) {
        uploadPolicyDocumentToR2({ localPath, r2Key });
        stats.documentsUploaded += 1;
      }
      stats.documentsCopied += 1;

      const entry: PolicyDocument = {
        policyDocumentId: doc.policyDocumentId,
        policyId: policyUuid,
        name: doc.documentName,
        filename: doc.filename,
        generationKey: `legacy:${doc.policyDocumentId}`,
        content: doc.documentName,
        generatedWhen: doc.generatedWhen ?? new Date().toISOString(),
        generatedBy: createdBy,
        documentTypeCode: doc.documentTypeCode,
        r2Key,
      };

      const list = policyDocumentsByLegacyId.get(doc.policyId) ?? [];
      list.push(entry);
      policyDocumentsByLegacyId.set(doc.policyId, list);

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
      `  documents done — ${copiedLabel} ${copiedCount}, missing ${stats.documentsMissing}`,
    );
    if (options.missingDocumentsCsv) {
      writeMissingPolicyDocumentsCsv(
        options.missingDocumentsCsv,
        missingDocuments,
      );
      stats.missingDocumentsCsv = options.missingDocumentsCsv;
      console.log(
        `  wrote ${missingDocuments.length} missing document(s) to ${options.missingDocumentsCsv}`,
      );
    }
  }

  if (shouldRun("policies", slices)) {
    const { rows: policyRows, suffixed: policyNumbersSuffixed } =
      dedupeLegacyPolicyNumbers(options.data.policies);
    console.log(`Loading ${policyRows.length} policies…`);
    if (policyNumbersSuffixed > 0) {
      console.log(
        `  suffixed ${policyNumbersSuffixed} duplicate policy number(s) for Postgres uniqueness`,
      );
    }
    if (options.replace) {
      await db.execute(sql`
        TRUNCATE TABLE
          policy_car_adjustment,
          policy_car,
          policy
        RESTART IDENTITY CASCADE
      `);
    }

    const chunkSize = 25;
    for (let i = 0; i < policyRows.length; i += chunkSize) {
      const chunk = policyRows.slice(i, i + chunkSize);
      for (const row of chunk) {
        const policyDoc = legacyPolicyRowToPolicy(row);
        const docs = policyDocumentsByLegacyId.get(row.policyId);
        if (docs?.length) {
          policyDoc.documents = docs;
        }
        const { policyValues, carValues, adjustmentValues } =
          policyToRows(policyDoc);
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
      }
      if ((i + chunkSize) % 500 === 0 || i + chunkSize >= policyRows.length) {
        console.log(
          `  … ${Math.min(i + chunkSize, policyRows.length)} / ${policyRows.length}`,
        );
      }
    }
    stats.policies = policyRows.length;
  } else if (shouldRun("documents", slices) && policyDocumentsByLegacyId.size) {
    const policyUpdates = [...policyDocumentsByLegacyId.entries()];
    console.log(
      `Updating app_extras.documents on ${policyUpdates.length} policies…`,
    );
    const updateEvery = documentProgressInterval(policyUpdates.length);
    let updated = 0;
    for (const [legacyPolicyId, docs] of policyUpdates) {
      updated += 1;
      const policyUuid = legacyPolicyUuid(legacyPolicyId);
      const [existing] = await db
        .select({ appExtras: policyCar.appExtras })
        .from(policyCar)
        .where(eq(policyCar.policyId, policyUuid))
        .limit(1);
      if (!existing) continue;
      const merged = {
        ...(existing.appExtras ?? {}),
        documents: docs,
      };
      await db
        .update(policyCar)
        .set({ appExtras: merged })
        .where(eq(policyCar.policyId, policyUuid));

      if (
        updated === 1 ||
        updated === policyUpdates.length ||
        updated % updateEvery === 0
      ) {
        const left = policyUpdates.length - updated;
        const pct =
          policyUpdates.length > 0
            ? Math.round((updated / policyUpdates.length) * 100)
            : 100;
        console.log(
          `  policies ${updated}/${policyUpdates.length} (${left} left, ${pct}%)`,
        );
      }
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
