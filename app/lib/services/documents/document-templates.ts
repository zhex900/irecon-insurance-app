import type { Template } from "@pdfme/common";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "~/lib/db/client";
import { appDocumentTemplateVersion } from "~/lib/db/schema";
import type { FlowPushDown } from "~/lib/pdf/flow-push-down";
import {
  listPdfTemplateSlots,
  resolvePdfTemplate,
  resolvePdfTemplateByKey,
  type PdfTemplateSlot,
} from "~/lib/pdf/templates";

const pdfmeTemplateSchema = z.object({
  basePdf: z.union([z.string(), z.record(z.string(), z.unknown())]),
  schemas: z.array(z.array(z.record(z.string(), z.unknown()))),
});

const flowPushDownSchema = z
  .object({
    pageIndex: z.number().int().nonnegative(),
    anchor: z.string().min(1),
    anchorOriginalHeightMm: z.number().positive(),
    followFields: z.array(z.string()),
    staticInputs: z.record(z.string(), z.string()),
  })
  .nullable()
  .optional();

export const saveDocumentTemplateInputSchema = z.object({
  slotKey: z.string().min(1).max(64),
  template: pdfmeTemplateSchema,
  flowPushDown: flowPushDownSchema,
  mergeFields: z.array(z.string()).optional(),
});

export type DocumentTemplateVersion = {
  id: number;
  slotKey: string;
  template: Template;
  flowPushDown: FlowPushDown | null;
  mergeFields: string[];
  versionNumber: number;
  isPublished: boolean;
  createdWhen: string | null;
  createdBy: string;
};

export type DocumentTemplateListItem = {
  key: string;
  documentTypeCode: string;
  coverTypeId: number | null;
  title: string;
  sourceFile: string;
  /** True when a published override exists (seed is not live). */
  hasPublished: boolean;
  publishedVersionNumber: number | null;
  latestVersionNumber: number | null;
  updatedWhen: string | null;
  updatedBy: string;
};

export type DocumentTemplateEditorState = {
  slot: PdfTemplateSlot;
  /** Version currently loaded in the editor (latest draft/publish, or seed). */
  editingVersionNumber: number | null;
  editingIsPublished: boolean;
  publishedVersionNumber: number | null;
  versions: Array<{
    versionNumber: number;
    isPublished: boolean;
    createdWhen: string | null;
    createdBy: string;
  }>;
  canUndo: boolean;
};

function isKnownSlotKey(slotKey: string): boolean {
  return listPdfTemplateSlots().some((slot) => slot.key === slotKey);
}

function rowToVersion(
  row: typeof appDocumentTemplateVersion.$inferSelect,
): DocumentTemplateVersion {
  return {
    id: row.documentTemplateVersionId,
    slotKey: row.slotKey,
    template: row.templateJson as Template,
    flowPushDown: (row.flowPushDown as FlowPushDown | null) ?? null,
    mergeFields: Array.isArray(row.mergeFields) ? row.mergeFields : [],
    versionNumber: row.versionNumber,
    isPublished: Boolean(row.isPublished),
    createdWhen: row.createdWhen?.toISOString() ?? null,
    createdBy: row.createdBy,
  };
}

export function mergeSlotWithOverride(
  base: PdfTemplateSlot,
  override: Pick<
    DocumentTemplateVersion,
    "template" | "flowPushDown" | "mergeFields" | "versionNumber"
  >,
): PdfTemplateSlot {
  return {
    ...base,
    template: override.template,
    flowPushDown: override.flowPushDown ?? base.flowPushDown ?? null,
    mergeFields:
      override.mergeFields.length > 0 ? override.mergeFields : base.mergeFields,
    versionNumber: override.versionNumber,
  };
}

export async function listDocumentTemplateVersions(
  slotKey: string,
): Promise<DocumentTemplateVersion[]> {
  if (!isKnownSlotKey(slotKey)) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(eq(appDocumentTemplateVersion.slotKey, slotKey))
    .orderBy(desc(appDocumentTemplateVersion.versionNumber));
  return rows.map(rowToVersion);
}

export async function getPublishedDocumentTemplate(
  slotKey: string,
): Promise<DocumentTemplateVersion | null> {
  if (!isKnownSlotKey(slotKey)) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(
      and(
        eq(appDocumentTemplateVersion.slotKey, slotKey),
        eq(appDocumentTemplateVersion.isPublished, true),
      ),
    )
    .limit(1);
  return row ? rowToVersion(row) : null;
}

export async function getLatestDocumentTemplate(
  slotKey: string,
): Promise<DocumentTemplateVersion | null> {
  if (!isKnownSlotKey(slotKey)) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(eq(appDocumentTemplateVersion.slotKey, slotKey))
    .orderBy(desc(appDocumentTemplateVersion.versionNumber))
    .limit(1);
  return row ? rowToVersion(row) : null;
}

/** Published override only — used for PDF generation. */
export async function getDocumentTemplateOverride(
  slotKey: string,
): Promise<DocumentTemplateVersion | null> {
  return getPublishedDocumentTemplate(slotKey);
}

export async function listDocumentTemplates(): Promise<
  DocumentTemplateListItem[]
> {
  const db = getDb();
  const rows = await db.select().from(appDocumentTemplateVersion);
  const bySlot = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = bySlot.get(row.slotKey) ?? [];
    list.push(row);
    bySlot.set(row.slotKey, list);
  }

  return listPdfTemplateSlots().map((slot) => {
    const versions = bySlot.get(slot.key) ?? [];
    const published = versions.find((v) => v.isPublished);
    const latest = versions.reduce<(typeof rows)[number] | null>((acc, row) => {
      if (!acc || row.versionNumber > acc.versionNumber) return row;
      return acc;
    }, null);

    return {
      key: slot.key,
      documentTypeCode: slot.documentTypeCode,
      coverTypeId: slot.coverTypeId,
      title: slot.title,
      sourceFile: slot.sourceFile,
      hasPublished: Boolean(published),
      publishedVersionNumber: published?.versionNumber ?? null,
      latestVersionNumber: latest?.versionNumber ?? null,
      updatedWhen:
        latest?.createdWhen?.toISOString() ??
        published?.createdWhen?.toISOString() ??
        null,
      updatedBy: latest?.createdBy ?? published?.createdBy ?? "",
    };
  });
}

/** Slot for the editor: latest version if any, else seed. */
export async function getEditableDocumentTemplateSlot(
  slotKey: string,
): Promise<DocumentTemplateEditorState | null> {
  const base = resolvePdfTemplateByKey(slotKey);
  if (!base) return null;

  const versions = await listDocumentTemplateVersions(slotKey);
  const published = versions.find((v) => v.isPublished) ?? null;
  const latest = versions[0] ?? null;
  const editing = latest;

  const slot = editing ? mergeSlotWithOverride(base, editing) : base;

  return {
    slot,
    editingVersionNumber: editing?.versionNumber ?? null,
    editingIsPublished: Boolean(editing?.isPublished),
    publishedVersionNumber: published?.versionNumber ?? null,
    versions: versions.map((v) => ({
      versionNumber: v.versionNumber,
      isPublished: v.isPublished,
      createdWhen: v.createdWhen,
      createdBy: v.createdBy,
    })),
    canUndo: Boolean(published),
  };
}

/** @deprecated Prefer getEditableDocumentTemplateSlot for the editor. */
export async function getActiveDocumentTemplateSlot(
  slotKey: string,
): Promise<PdfTemplateSlot | null> {
  const state = await getEditableDocumentTemplateSlot(slotKey);
  return state?.slot ?? null;
}

export async function resolveActivePdfTemplate(
  documentTypeCode: PdfTemplateSlot["documentTypeCode"],
  coverTypeId: number,
): Promise<PdfTemplateSlot | null> {
  const base = resolvePdfTemplate(documentTypeCode, coverTypeId);
  if (!base) return null;
  const published = await getPublishedDocumentTemplate(base.key);
  if (!published) return base;
  return mergeSlotWithOverride(base, published);
}

async function nextVersionNumber(slotKey: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      max: sql<number>`coalesce(max(${appDocumentTemplateVersion.versionNumber}), 0)`,
    })
    .from(appDocumentTemplateVersion)
    .where(eq(appDocumentTemplateVersion.slotKey, slotKey));
  return Number(row?.max ?? 0) + 1;
}

async function insertVersion(input: {
  slotKey: string;
  template: Record<string, unknown>;
  flowPushDown: Record<string, unknown> | null;
  mergeFields: string[];
  isPublished: boolean;
  createdBy: string;
}): Promise<DocumentTemplateVersion> {
  const db = getDb();
  const versionNumber = await nextVersionNumber(input.slotKey);

  if (input.isPublished) {
    await db
      .update(appDocumentTemplateVersion)
      .set({ isPublished: false })
      .where(
        and(
          eq(appDocumentTemplateVersion.slotKey, input.slotKey),
          eq(appDocumentTemplateVersion.isPublished, true),
        ),
      );
  }

  const [row] = await db
    .insert(appDocumentTemplateVersion)
    .values({
      slotKey: input.slotKey,
      versionNumber,
      templateJson: input.template,
      flowPushDown: input.flowPushDown,
      mergeFields: input.mergeFields,
      isPublished: input.isPublished,
      createdWhen: new Date(),
      createdBy: input.createdBy,
    })
    .returning();

  if (!row) throw new Error("Failed to save document template version");
  return rowToVersion(row);
}

function resolvePayload(
  slotKey: string,
  parsed: z.infer<typeof saveDocumentTemplateInputSchema>,
) {
  const base = resolvePdfTemplateByKey(slotKey);
  if (!base) throw new Error(`Missing seed template for slot: ${slotKey}`);

  const mergeFields =
    parsed.mergeFields && parsed.mergeFields.length > 0
      ? parsed.mergeFields
      : base.mergeFields;
  const flowPushDown =
    parsed.flowPushDown === undefined
      ? (base.flowPushDown ?? null)
      : parsed.flowPushDown;

  return {
    template: parsed.template as Record<string, unknown>,
    flowPushDown: flowPushDown as Record<string, unknown> | null,
    mergeFields,
  };
}

/** Save a new draft version (not used for generation until published). */
export async function saveDocumentTemplateDraft(
  input: z.infer<typeof saveDocumentTemplateInputSchema>,
  createdBy = "",
): Promise<DocumentTemplateVersion> {
  const parsed = saveDocumentTemplateInputSchema.parse(input);
  if (!isKnownSlotKey(parsed.slotKey)) {
    throw new Error(`Unknown document template slot: ${parsed.slotKey}`);
  }
  const payload = resolvePayload(parsed.slotKey, parsed);
  return insertVersion({
    slotKey: parsed.slotKey,
    ...payload,
    isPublished: false,
    createdBy,
  });
}

/** Save current layout as a new version and publish it (live for generation). */
export async function publishDocumentTemplate(
  input: z.infer<typeof saveDocumentTemplateInputSchema>,
  createdBy = "",
): Promise<DocumentTemplateVersion> {
  const parsed = saveDocumentTemplateInputSchema.parse(input);
  if (!isKnownSlotKey(parsed.slotKey)) {
    throw new Error(`Unknown document template slot: ${parsed.slotKey}`);
  }
  const payload = resolvePayload(parsed.slotKey, parsed);
  return insertVersion({
    slotKey: parsed.slotKey,
    ...payload,
    isPublished: true,
    createdBy,
  });
}

/** Publish an existing version by number (undo / restore). */
export async function publishDocumentTemplateVersion(
  slotKey: string,
  versionNumber: number,
  createdBy = "",
): Promise<DocumentTemplateVersion> {
  if (!isKnownSlotKey(slotKey)) {
    throw new Error(`Unknown document template slot: ${slotKey}`);
  }
  const db = getDb();
  const [target] = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(
      and(
        eq(appDocumentTemplateVersion.slotKey, slotKey),
        eq(appDocumentTemplateVersion.versionNumber, versionNumber),
      ),
    )
    .limit(1);
  if (!target) {
    throw new Error(`Version ${versionNumber} not found for ${slotKey}`);
  }

  await db
    .update(appDocumentTemplateVersion)
    .set({ isPublished: false })
    .where(
      and(
        eq(appDocumentTemplateVersion.slotKey, slotKey),
        eq(appDocumentTemplateVersion.isPublished, true),
      ),
    );

  const [row] = await db
    .update(appDocumentTemplateVersion)
    .set({
      isPublished: true,
      // Keep original created_* ; audit trail records who republished.
    })
    .where(
      eq(
        appDocumentTemplateVersion.documentTemplateVersionId,
        target.documentTemplateVersionId,
      ),
    )
    .returning();

  if (!row) throw new Error("Failed to publish document template version");
  void createdBy;
  return rowToVersion(row);
}

/**
 * Undo publish: restore the previous version as published.
 * If none exists, clear publish (generation falls back to seed).
 */
export async function undoDocumentTemplatePublish(
  slotKey: string,
  createdBy = "",
): Promise<{
  published: DocumentTemplateVersion | null;
  usedSeed: boolean;
}> {
  if (!isKnownSlotKey(slotKey)) {
    throw new Error(`Unknown document template slot: ${slotKey}`);
  }

  const published = await getPublishedDocumentTemplate(slotKey);
  if (!published) {
    return { published: null, usedSeed: true };
  }

  const db = getDb();
  const [previous] = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(
      and(
        eq(appDocumentTemplateVersion.slotKey, slotKey),
        lt(appDocumentTemplateVersion.versionNumber, published.versionNumber),
      ),
    )
    .orderBy(desc(appDocumentTemplateVersion.versionNumber))
    .limit(1);

  await db
    .update(appDocumentTemplateVersion)
    .set({ isPublished: false })
    .where(
      and(
        eq(appDocumentTemplateVersion.slotKey, slotKey),
        eq(appDocumentTemplateVersion.isPublished, true),
      ),
    );

  if (!previous) {
    return { published: null, usedSeed: true };
  }

  const restored = await publishDocumentTemplateVersion(
    slotKey,
    previous.versionNumber,
    createdBy,
  );
  return { published: restored, usedSeed: false };
}

/** Remove all versions for a slot (back to seed assets). */
export async function resetDocumentTemplate(slotKey: string): Promise<boolean> {
  if (!isKnownSlotKey(slotKey)) {
    throw new Error(`Unknown document template slot: ${slotKey}`);
  }
  const db = getDb();
  const deleted = await db
    .delete(appDocumentTemplateVersion)
    .where(eq(appDocumentTemplateVersion.slotKey, slotKey))
    .returning({
      id: appDocumentTemplateVersion.documentTemplateVersionId,
    });
  return deleted.length > 0;
}

/** @deprecated Use saveDocumentTemplateDraft or publishDocumentTemplate. */
export async function saveDocumentTemplate(
  input: z.infer<typeof saveDocumentTemplateInputSchema>,
  updatedBy = "",
): Promise<DocumentTemplateVersion> {
  return publishDocumentTemplate(input, updatedBy);
}
