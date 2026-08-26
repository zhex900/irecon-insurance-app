import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import type { R2BucketLike } from "~/lib/cloudflare.server";
import {
  assignPolicyDocumentIds,
  assignPolicyNoteIds,
} from "~/lib/db/assign-child-uuids";
import { getDb } from "~/lib/db/client";
import {
  type PolicyChildRows,
  policyToRows,
  rowsToPolicy,
} from "~/lib/db/policy-mapper";
import {
  policy,
  policyCar,
  policyCarAdjustment,
  policyCarSelectedWording,
  policyDocument,
  policyNote,
} from "~/lib/db/schema";
import type { Policy, PolicySummary } from "~/lib/db/types";
import { trackUsage } from "~/lib/observability/metrics.server";
import type { PdfWorkerBinding } from "~/lib/pdf/pdf-worker.server";
import { normalizeExcesses } from "~/lib/policies/excesses";
import { createInformationalNote } from "~/lib/policies/policy-notes";
import { formatPolicyNumberFromSeq } from "~/lib/policies/policy-number";
import { normalizeSubLimits } from "~/lib/policies/sub-limits";
import { getClient, listClients } from "~/lib/services/clients/service";
import {
  removeRecentRoutesForEntity,
  removeRecentRoutesForPolicies,
} from "~/lib/services/navigation/recent-routes.server";
import {
  applyPolicyDocumentR2Keys,
  preservePolicyDocumentR2Keys,
  sanitizePolicyDocumentForDb,
} from "~/lib/services/policy/documents/persist.server";
import {
  getDefaultExcesses,
  getReferenceData,
} from "~/lib/services/reference.service";
import { POLICY_STATUS } from "~/lib/zod/policy-car";

const POLICY_NUMBER_ALLOCATE_MAX_ATTEMPTS = 25;

export type SavePolicyOptions = {
  actor?: string;
  libraryBucket?: R2BucketLike | null;
  pdfService?: PdfWorkerBinding | null;
};

/**
 * Next human-facing policy number from {@link policy_number_seq}, skipping values
 * already held by another policy (seq can lag after imports or manual inserts).
 */
export async function allocatePolicyNumber(policyId: string): Promise<string> {
  const db = getDb();
  for (
    let attempt = 0;
    attempt < POLICY_NUMBER_ALLOCATE_MAX_ATTEMPTS;
    attempt++
  ) {
    const [seqRow] = await db.execute<{ seq: number | string }>(
      sql`SELECT nextval('policy_number_seq') AS "seq"`,
    );
    const policyNumber = formatPolicyNumberFromSeq(Number(seqRow?.seq ?? 1000));
    if (!(await isPolicyNumberTaken(policyNumber, policyId))) {
      return policyNumber;
    }
  }
  throw new Error("Could not allocate a unique policy number");
}

/**
 * True when another policy already holds this number (case-insensitive).
 * `excludePolicyId` keeps a policy from colliding with itself.
 */
export async function isPolicyNumberTaken(
  policyNumber: string,
  excludePolicyId: string,
): Promise<boolean> {
  const trimmed = policyNumber.trim();
  if (!trimmed) return false;

  const db = getDb();
  const rows = await db
    .select({ policyId: policy.policyId })
    .from(policy)
    .where(
      and(
        sql`lower(${policy.policyNumber}) = lower(${trimmed})`,
        ne(policy.policyId, excludePolicyId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Delete an unsaved new-policy draft (Pending + isDraft only). */
export async function deletePolicyDraft(policyId: string, userId?: string) {
  const existing = await getPolicy(policyId);
  if (!existing) throw new Error("Policy not found");
  if (existing.policyStatusId !== 1 || !existing.isDraft) {
    throw new Error("Only draft policies can be discarded");
  }

  const db = getDb();
  await db.delete(policy).where(eq(policy.policyId, policyId));

  if (userId) {
    await removeRecentRoutesForEntity(userId, { kind: "policy", id: policyId });
  }

  return existing;
}

/**
 * Delete one or more non-terminal (Pending) policies.
 * Taken / Not taken policies are rejected.
 * Pass `clientId` to require all policies belong to that client.
 * Pass `userId` to also clean up recent navigation entries for deleted policies.
 */
export async function deletePolicies(
  policyIds: string[],
  options?: { clientId?: string; userId?: string },
) {
  const ids = [...new Set(policyIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new Error("No policies selected");

  const db = getDb();
  const rows = await db
    .select({
      policyId: policy.policyId,
      policyNumber: policy.policyNumber,
      clientId: policy.clientId,
      policyStatusId: policy.policyStatusId,
      isDraft: policy.isDraft,
    })
    .from(policy)
    .where(inArray(policy.policyId, ids));

  if (rows.length !== ids.length) {
    throw new Error("One or more policies were not found");
  }

  if (
    options?.clientId != null &&
    rows.some((row) => row.clientId !== options.clientId)
  ) {
    throw new Error("Policies must belong to this client");
  }

  const blocked = rows.filter((row) => row.policyStatusId !== 1);
  if (blocked.length > 0) {
    throw new Error("Taken and not taken policies cannot be deleted");
  }

  // Delete the policies
  await db
    .delete(policy)
    .where(and(inArray(policy.policyId, ids), eq(policy.policyStatusId, 1)));

  if (options?.userId) {
    await removeRecentRoutesForPolicies(options.userId, ids);
  }

  return rows;
}

async function loadPolicyChildren(
  policyIds: string[],
): Promise<Map<string, PolicyChildRows>> {
  const byPolicy = new Map<string, PolicyChildRows>();
  if (policyIds.length === 0) return byPolicy;

  const db = getDb();
  const [documents, notes, selectedWordings] = await Promise.all([
    db
      .select({
        documentId: policyDocument.documentId,
        policyId: policyDocument.policyId,
        name: policyDocument.name,
        filename: policyDocument.filename,
        generationKey: policyDocument.generationKey,
        templateKey: policyDocument.templateKey,
        libraryDocumentId: policyDocument.libraryDocumentId,
        generatedWhen: policyDocument.generatedWhen,
        generatedBy: policyDocument.generatedBy,
        documentTypeCode: policyDocument.documentTypeCode,
        r2Key: policyDocument.r2Key,
      })
      .from(policyDocument)
      .where(inArray(policyDocument.policyId, policyIds)),
    db.select().from(policyNote).where(inArray(policyNote.policyId, policyIds)),
    db
      .select()
      .from(policyCarSelectedWording)
      .where(inArray(policyCarSelectedWording.policyId, policyIds)),
  ]);

  for (const policyId of policyIds) {
    byPolicy.set(policyId, {
      documents: [],
      notes: [],
      selectedWordings: [],
    });
  }

  for (const row of documents) {
    byPolicy.get(row.policyId)?.documents?.push(row);
  }
  for (const row of notes) {
    byPolicy.get(row.policyId)?.notes?.push(row);
  }
  for (const row of selectedWordings) {
    byPolicy.get(row.policyId)?.selectedWordings?.push(row);
  }

  return byPolicy;
}

async function loadPolicyById(policyId: string): Promise<Policy | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(
      policyCarAdjustment,
      eq(policy.policyId, policyCarAdjustment.policyId),
    )
    .where(eq(policy.policyId, policyId))
    .limit(1);

  if (!row) return null;
  const children = await loadPolicyChildren([policyId]);
  return normalizePolicy(
    rowsToPolicy(
      row.policy,
      row.policy_car,
      row.policy_car_adjustment,
      children.get(policyId),
    ),
  );
}

export async function listPolicies(clientId?: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(policy)
    .innerJoin(policyCar, eq(policy.policyId, policyCar.policyId))
    .leftJoin(
      policyCarAdjustment,
      eq(policy.policyId, policyCarAdjustment.policyId),
    )
    .where(clientId ? eq(policy.clientId, clientId) : undefined)
    .orderBy(desc(policy.createdWhen));

  const childrenByPolicy = await loadPolicyChildren(
    rows.map((row) => row.policy.policyId),
  );

  return rows.map((row) =>
    normalizePolicy(
      rowsToPolicy(
        row.policy,
        row.policy_car,
        row.policy_car_adjustment,
        childrenByPolicy.get(row.policy.policyId),
      ),
    ),
  );
}

export async function listPolicySummaries(
  search?: string,
): Promise<PolicySummary[]> {
  const [policies, clients] = await Promise.all([
    listPolicies(),
    listClients(),
  ]);
  const clientById = new Map(clients.map((c) => [c.clientId, c.name]));

  const summaries = policies
    .map((item) => ({
      policyId: item.policyId,
      policyNumber: item.policyNumber,
      insuredName: item.car.insuredName,
      clientName: clientById.get(item.clientId) ?? "",
      policyStatusId: item.policyStatusId,
      isDraft: item.isDraft,
      createdWhen: item.createdWhen,
    }))
    .sort((a, b) => b.createdWhen.localeCompare(a.createdWhen));

  if (!search?.trim()) {
    return summaries.map(
      ({ createdWhen: _createdWhen, ...summary }) => summary,
    );
  }

  const q = search.toLowerCase();
  return summaries
    .filter(
      (summary) =>
        summary.policyNumber.toLowerCase().includes(q) ||
        summary.insuredName.toLowerCase().includes(q) ||
        summary.clientName.toLowerCase().includes(q),
    )
    .map(({ createdWhen: _createdWhen, ...summary }) => summary);
}

export async function getPolicy(policyId: string) {
  return loadPolicyById(policyId);
}

function normalizePolicy(item: Policy): Policy {
  const ref = getReferenceData();
  return {
    ...item,
    insurerCode: item.insurerCode ?? ref.insurers[0].code,
    car: {
      ...item.car,
      subLimits: normalizeSubLimits(
        item.car.subLimits ?? { ...ref.defaultSubLimits.annual },
      ),
      excesses: normalizeExcesses(
        item.car.excesses ?? {
          ...ref.defaultExcesses,
          excessAdditionalNotes: "",
        },
        item.car.estimatedTurnover,
      ),
      excludedContracts1:
        item.car.excludedContracts1 ?? ref.defaultTexts.excludedContracts1,
      excludedContracts2:
        item.car.excludedContracts2 ?? ref.defaultTexts.excludedContracts2,
      excludedContracts3:
        item.car.excludedContracts3 ?? ref.defaultTexts.excludedContracts3,
      selectedWordingIds: item.car.selectedWordingIds ?? [],
      referralReasons: item.car.referralReasons ?? [],
    },
  };
}

export async function savePolicy(
  policyDoc: Policy,
  options?: SavePolicyOptions,
) {
  const db = getDb();
  const sanitizedPolicy: Policy = {
    ...policyDoc,
    documents: policyDoc.documents?.map(sanitizePolicyDocumentForDb),
  };
  const {
    policyValues,
    carValues,
    adjustmentValues,
    documentValues,
    noteValues,
    selectedWordingIds,
  } = policyToRows(sanitizedPolicy);

  const existingDocuments = await db
    .select({
      documentId: policyDocument.documentId,
      templateKey: policyDocument.templateKey,
      libraryDocumentId: policyDocument.libraryDocumentId,
      filename: policyDocument.filename,
      generationKey: policyDocument.generationKey,
      r2Key: policyDocument.r2Key,
    })
    .from(policyDocument)
    .where(eq(policyDocument.policyId, policyDoc.policyId));

  let documentsToInsert = assignPolicyDocumentIds(
    existingDocuments,
    documentValues,
  );

  if (options?.pdfService) {
    documentsToInsert = await applyPolicyDocumentR2Keys(
      sanitizedPolicy,
      documentsToInsert,
      existingDocuments,
      {
        libraryBucket: options.libraryBucket ?? null,
        pdfService: options.pdfService,
      },
    );
  } else {
    documentsToInsert = preservePolicyDocumentR2Keys(
      documentsToInsert,
      existingDocuments,
    );
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        policyStatusId: policy.policyStatusId,
        takenAt: policy.takenAt,
        takenBy: policy.takenBy,
      })
      .from(policy)
      .where(eq(policy.policyId, policyDoc.policyId))
      .limit(1);

    let takenAt = existing?.takenAt ?? null;
    let takenBy = existing?.takenBy ?? null;
    if (
      policyValues.policyStatusId === POLICY_STATUS.Taken &&
      existing?.policyStatusId !== POLICY_STATUS.Taken &&
      takenAt == null
    ) {
      takenAt = new Date();
      takenBy = options?.actor?.trim() || policyDoc.createdBy || "";
    }

    const takenFields =
      takenAt != null ? { takenAt, takenBy: takenBy ?? "" } : {};

    await tx
      .insert(policy)
      .values({ ...policyValues, ...takenFields })
      .onConflictDoUpdate({
        target: policy.policyId,
        set: {
          clientId: policyValues.clientId,
          policyStatusId: policyValues.policyStatusId,
          postcode: policyValues.postcode,
          stateId: policyValues.stateId,
          policyCategoryId: policyValues.policyCategoryId,
          policyNumber: policyValues.policyNumber,
          dateStart: policyValues.dateStart,
          dateEnd: policyValues.dateEnd,
          insurerCode: policyValues.insurerCode,
          isDraft: policyValues.isDraft,
          updatedWhen: new Date(),
          ...takenFields,
        },
      });

    await tx
      .insert(policyCar)
      .values(carValues)
      .onConflictDoUpdate({
        target: policyCar.policyId,
        set: { ...carValues },
      });

    await tx
      .delete(policyDocument)
      .where(eq(policyDocument.policyId, policyDoc.policyId));
    if (documentsToInsert.length > 0) {
      await tx.insert(policyDocument).values(documentsToInsert);
    }

    const existingNotes = await tx
      .select({ noteId: policyNote.noteId })
      .from(policyNote)
      .where(eq(policyNote.policyId, policyDoc.policyId));

    await tx
      .delete(policyNote)
      .where(eq(policyNote.policyId, policyDoc.policyId));
    if (noteValues.length > 0) {
      const notes = assignPolicyNoteIds(existingNotes, noteValues);
      await tx.insert(policyNote).values(notes);
    }

    await tx
      .delete(policyCarSelectedWording)
      .where(eq(policyCarSelectedWording.policyId, policyDoc.policyId));
    if (selectedWordingIds.length > 0) {
      await tx.insert(policyCarSelectedWording).values(
        selectedWordingIds.map((carWordingId) => ({
          policyId: policyDoc.policyId,
          carWordingId,
        })),
      );
    }

    if (adjustmentValues) {
      await tx
        .insert(policyCarAdjustment)
        .values(adjustmentValues)
        .onConflictDoUpdate({
          target: policyCarAdjustment.policyId,
          set: { ...adjustmentValues, updatedWhen: new Date() },
        });
    } else {
      await tx
        .delete(policyCarAdjustment)
        .where(eq(policyCarAdjustment.policyId, policyDoc.policyId));
    }
  });

  const saved = await loadPolicyById(policyDoc.policyId);
  if (!saved) throw new Error("Failed to save policy");
  return saved;
}

export async function createPolicyDraft(
  clientId: string,
  partial: Partial<Policy> = {},
  createdBy: string,
) {
  const ref = getReferenceData();
  const defaultExcesses = await getDefaultExcesses();
  const existingClient = await getClient(clientId);
  if (!existingClient) throw new Error("Client not found");

  const policyId = crypto.randomUUID();
  const policyNumber = await allocatePolicyNumber(policyId);
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  nextYear.setDate(nextYear.getDate() - 1);

  const draft: Policy = {
    policyCategoryId: 1,
    policyStatusId: 1,
    postcode: "",
    stateId: 0,
    dateEffective: today.toISOString().slice(0, 10),
    dateStart: today.toISOString().slice(0, 10),
    dateEnd: nextYear.toISOString().slice(0, 10),
    createdWhen: new Date().toISOString(),
    createdBy,
    insurerCode: ref.insurers[0].code,
    isDraft: true,
    car: {
      coverTypeId: 1,
      annualCoverTypeId: null,
      siteAddress: "",
      insuredName: "",
      estimatedTurnover: 0,
      businessActivities: ref.defaultTexts.businessActivities,
      insuredContracts: "",
      geographicalScopes: ref.defaultTexts.geographicalScopeAnnual,
      plantEquipment: 0,
      existingStructure: 0,
      displayHomes: 0,
      claimsCountLast3Years: 0,
      anyClaimsExceed20k: false,
      declarationConfirmed: false,
      contractWorksSumInsured: 0,
      liabilityLimitBand: 1,
      hasExistingContractWorksCover: false,
      currentInsurer: "",
      maximumConstructionPeriod: 18,
      maximumMaintenancePeriod: 12,
      contractWorksExistingStructurePremium: 0,
      contractWorksDisplayHomesPremium: 0,
      subLimits: { ...ref.defaultSubLimits.annual },
      excesses: {
        ...defaultExcesses,
        excessAdditionalNotes: "",
      },
      excludedContracts1: ref.defaultTexts.excludedContracts1,
      excludedContracts2: ref.defaultTexts.excludedContracts2,
      excludedContracts3: ref.defaultTexts.excludedContracts3,
      selectedWordingIds: [],
      customWordings: [],
      referralReasons: [],
    },
    ...partial,
    policyId,
    clientId,
    policyNumber: partial.policyNumber ?? policyNumber,
    // Always seed a creation note unless the caller supplied notes (e.g. import).
    notes: partial.notes ?? [
      createInformationalNote(policyId, "Policy Created", createdBy),
    ],
  };

  const saved = await savePolicy(draft);
  trackUsage("policy.draft_create");
  return saved;
}
