import type { Template } from "@pdfme/common";
import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "~/lib/db/client";
import { appDocumentTemplateVersion } from "~/lib/db/schema";
import { promoteStaticBackgroundToEditableSchemas } from "~/lib/pdf/extract-base-pdf-rectangles";
import type { FlowPushDown } from "~/lib/pdf/flow-push-down";
import {
  DOCUMENT_LABEL_MAX_LENGTH,
  documentLabelFromFilename,
  normalizeDocumentLabel,
} from "~/lib/documents/document-label";
import {
  DOCUMENT_TEMPLATE_BLANK_BASE_PDF,
  withBlankPageBackground,
  type DocumentTemplate,
} from "~/lib/pdf/templates";
import { isBlankPdf } from "@pdfme/common";

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
  documentTemplateKey: z.string().min(1).max(64),
  template: pdfmeTemplateSchema,
  flowPushDown: flowPushDownSchema,
  mergeFields: z.array(z.string()).optional(),
});

export const createDocumentTemplateInputSchema = z.object({
  coverTypeId: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
  title: z.string().trim().min(1, "Title is required").max(512),
  label: z.string().max(DOCUMENT_LABEL_MAX_LENGTH).optional(),
});

export const updateDocumentTemplateMetaInputSchema = z.object({
  documentTemplateKey: z.string().min(1).max(64),
  coverTypeId: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
  title: z.string().max(512),
  label: z.string().max(DOCUMENT_LABEL_MAX_LENGTH),
});

/** Slugify a title into a document_template_key (lowercase, hyphens, max 64). */
export function slugifyDocumentTemplateKey(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug || "template";
}

export type DocumentTemplateVersion = {
  id: number;
  documentTemplateKey: string;
  coverTypeId: number | null;
  title: string;
  label: string;
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
  coverTypeId: number | null;
  title: string;
  label: string;
  hasPublished: boolean;
  publishedVersionNumber: number | null;
  latestVersionNumber: number | null;
  updatedWhen: string | null;
  updatedBy: string;
};

export type DocumentTemplateEditorState = {
  template: DocumentTemplate;
  editingVersionNumber: number | null;
  editingIsPublished: boolean;
  publishedVersionNumber: number | null;
  canUndo: boolean;
};

function rowToVersion(
  row: typeof appDocumentTemplateVersion.$inferSelect,
): DocumentTemplateVersion {
  return {
    id: row.documentTemplateVersionId,
    documentTemplateKey: row.documentTemplateKey,
    coverTypeId: row.coverTypeId ?? null,
    title: row.title ?? "",
    label:
      row.label?.trim() ||
      documentLabelFromFilename(row.title ?? row.documentTemplateKey),
    template: row.templateJson as Template,
    flowPushDown: (row.flowPushDown as FlowPushDown | null) ?? null,
    mergeFields: Array.isArray(row.mergeFields) ? row.mergeFields : [],
    versionNumber: row.versionNumber,
    isPublished: Boolean(row.isPublished),
    createdWhen: row.createdWhen?.toISOString() ?? null,
    createdBy: row.createdBy,
  };
}

function versionToTemplate(version: DocumentTemplateVersion): DocumentTemplate {
  return {
    key: version.documentTemplateKey,
    coverTypeId: version.coverTypeId,
    title: version.title,
    label: version.label,
    versionNumber: version.versionNumber,
    mergeFields: version.mergeFields,
    flowPushDown: version.flowPushDown,
    template: version.template,
  };
}

export async function listDocumentTemplateVersions(
  documentTemplateKey: string,
): Promise<DocumentTemplateVersion[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(
      eq(appDocumentTemplateVersion.documentTemplateKey, documentTemplateKey),
    )
    .orderBy(desc(appDocumentTemplateVersion.versionNumber));
  return rows.map(rowToVersion);
}

export async function getPublishedDocumentTemplate(
  documentTemplateKey: string,
): Promise<DocumentTemplateVersion | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(
      and(
        eq(appDocumentTemplateVersion.documentTemplateKey, documentTemplateKey),
        eq(appDocumentTemplateVersion.isPublished, true),
      ),
    )
    .limit(1);
  return row ? rowToVersion(row) : null;
}

export async function getLatestDocumentTemplate(
  documentTemplateKey: string,
): Promise<DocumentTemplateVersion | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(
      eq(appDocumentTemplateVersion.documentTemplateKey, documentTemplateKey),
    )
    .orderBy(desc(appDocumentTemplateVersion.versionNumber))
    .limit(1);
  return row ? rowToVersion(row) : null;
}

export async function getDocumentTemplateVersion(
  documentTemplateKey: string,
  versionNumber: number,
): Promise<DocumentTemplateVersion | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(
      and(
        eq(appDocumentTemplateVersion.documentTemplateKey, documentTemplateKey),
        eq(appDocumentTemplateVersion.versionNumber, versionNumber),
      ),
    )
    .limit(1);
  return row ? rowToVersion(row) : null;
}

/** Published template for PDF generation — null means nothing published (fail closed). */
export async function getDocumentTemplateOverride(
  documentTemplateKey: string,
): Promise<DocumentTemplateVersion | null> {
  return getPublishedDocumentTemplate(documentTemplateKey);
}

/** Seeded key for the CAR adjustment PDF — review packs must not include it. */
export const ADJUSTMENT_DOCUMENT_TEMPLATE_KEY = "adjustment";

async function listPublishedMatchingCover(
  coverTypeId: number,
): Promise<DocumentTemplate[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(
      and(
        eq(appDocumentTemplateVersion.isPublished, true),
        or(
          eq(appDocumentTemplateVersion.coverTypeId, coverTypeId),
          isNull(appDocumentTemplateVersion.coverTypeId),
        ),
      ),
    )
    .orderBy(appDocumentTemplateVersion.documentTemplateKey);

  return rows.map((row) => versionToTemplate(rowToVersion(row)));
}

/**
 * Published templates for review / quote packs.
 * Null-cover templates are included for every cover, except the adjustment
 * template which is adjustment-pack only.
 */
export async function listPublishedForCover(
  coverTypeId: number,
): Promise<DocumentTemplate[]> {
  const rows = await listPublishedMatchingCover(coverTypeId);
  return rows.filter((t) => t.key !== ADJUSTMENT_DOCUMENT_TEMPLATE_KEY);
}

/** Published adjustment template only (no schedule/rating/library pack docs). */
export async function listPublishedForAdjustment(): Promise<
  DocumentTemplate[]
> {
  const db = getDb();
  const rows = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(
      and(
        eq(appDocumentTemplateVersion.isPublished, true),
        eq(
          appDocumentTemplateVersion.documentTemplateKey,
          ADJUSTMENT_DOCUMENT_TEMPLATE_KEY,
        ),
      ),
    )
    .orderBy(appDocumentTemplateVersion.documentTemplateKey);

  return rows.map((row) => versionToTemplate(rowToVersion(row)));
}

export async function listDocumentTemplates(): Promise<
  DocumentTemplateListItem[]
> {
  const db = getDb();
  const rows = await db.select().from(appDocumentTemplateVersion);
  const byKey = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byKey.get(row.documentTemplateKey) ?? [];
    list.push(row);
    byKey.set(row.documentTemplateKey, list);
  }

  const items: DocumentTemplateListItem[] = [];
  for (const [key, versions] of byKey) {
    const published = versions.find((v) => v.isPublished);
    const latest = versions.reduce<(typeof rows)[number] | null>((acc, row) => {
      if (!acc || row.versionNumber > acc.versionNumber) return row;
      return acc;
    }, null);
    const meta = latest ?? published;
    if (!meta) continue;

    items.push({
      key,
      coverTypeId: meta.coverTypeId ?? null,
      title: meta.title || key,
      label: meta.label?.trim() || documentLabelFromFilename(meta.title || key),
      hasPublished: Boolean(published),
      publishedVersionNumber: published?.versionNumber ?? null,
      latestVersionNumber: latest?.versionNumber ?? null,
      updatedWhen:
        latest?.createdWhen?.toISOString() ??
        published?.createdWhen?.toISOString() ??
        null,
      updatedBy: latest?.createdBy ?? published?.createdBy ?? "",
    });
  }

  return items.sort((a, b) => {
    const coverA = a.coverTypeId ?? Number.POSITIVE_INFINITY;
    const coverB = b.coverTypeId ?? Number.POSITIVE_INFINITY;
    if (coverA !== coverB) return coverA - coverB;
    return a.title.localeCompare(b.title) || a.key.localeCompare(b.key);
  });
}

/** Editor state from latest DB version. Returns null if the key has no rows. */
export async function getEditableDocumentTemplate(
  documentTemplateKey: string,
): Promise<DocumentTemplateEditorState | null> {
  const [latest, published] = await Promise.all([
    getLatestDocumentTemplate(documentTemplateKey),
    getPublishedDocumentTemplate(documentTemplateKey),
  ]);
  if (!latest) return null;

  // Prefer latest schemas. Keep the latest blank-canvas basePdf (including
  // landscape) so orientation survives save → reopen. Only borrow an older
  // string basePdf when the latest version still needs static-PDF promotion.
  const latestBasePdf = latest.template.basePdf;
  let basePdfForEditor = latestBasePdf;
  if (!isBlankPdf(latestBasePdf) && typeof latestBasePdf !== "string") {
    const versions = await listDocumentTemplateVersions(documentTemplateKey);
    basePdfForEditor =
      versions.find((version) => typeof version.template.basePdf === "string")
        ?.template.basePdf ?? latestBasePdf;
  } else if (typeof latestBasePdf === "string") {
    basePdfForEditor = latestBasePdf;
  }

  const templateForEditor = promoteStaticBackgroundToEditableSchemas({
    ...latest.template,
    basePdf: basePdfForEditor,
    schemas: latest.template.schemas,
  });

  return {
    template: {
      ...versionToTemplate(latest),
      template: templateForEditor,
    },
    editingVersionNumber: latest.versionNumber,
    editingIsPublished: Boolean(latest.isPublished),
    publishedVersionNumber: published?.versionNumber ?? null,
    canUndo: Boolean(published),
  };
}

export async function resolvePublishedPdfTemplate(
  documentTemplateKey: string,
): Promise<DocumentTemplate | null> {
  const published = await getPublishedDocumentTemplate(documentTemplateKey);
  return published ? versionToTemplate(published) : null;
}

async function nextVersionNumber(documentTemplateKey: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      max: sql<number>`coalesce(max(${appDocumentTemplateVersion.versionNumber}), 0)`,
    })
    .from(appDocumentTemplateVersion)
    .where(
      eq(appDocumentTemplateVersion.documentTemplateKey, documentTemplateKey),
    );
  return Number(row?.max ?? 0) + 1;
}

async function insertVersion(input: {
  documentTemplateKey: string;
  coverTypeId: number | null;
  title: string;
  label: string;
  template: Record<string, unknown>;
  flowPushDown: Record<string, unknown> | null;
  mergeFields: string[];
  isPublished: boolean;
  createdBy: string;
}): Promise<DocumentTemplateVersion> {
  const db = getDb();
  const versionNumber = await nextVersionNumber(input.documentTemplateKey);

  if (input.isPublished) {
    await db
      .update(appDocumentTemplateVersion)
      .set({ isPublished: false })
      .where(
        and(
          eq(
            appDocumentTemplateVersion.documentTemplateKey,
            input.documentTemplateKey,
          ),
          eq(appDocumentTemplateVersion.isPublished, true),
        ),
      );
  }

  const [row] = await db
    .insert(appDocumentTemplateVersion)
    .values({
      documentTemplateKey: input.documentTemplateKey,
      coverTypeId: input.coverTypeId,
      title: input.title,
      label: input.label,
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

async function requireKeyMeta(documentTemplateKey: string): Promise<{
  coverTypeId: number | null;
  title: string;
  label: string;
}> {
  const latest = await getLatestDocumentTemplate(documentTemplateKey);
  if (!latest) {
    throw new Error(`Unknown document template: ${documentTemplateKey}`);
  }
  return {
    coverTypeId: latest.coverTypeId,
    title: latest.title,
    label: latest.label,
  };
}

/** Create a new template; key is auto-generated from the title. */
export async function createDocumentTemplate(
  input: z.infer<typeof createDocumentTemplateInputSchema>,
  createdBy = "",
): Promise<DocumentTemplateVersion> {
  const parsed = createDocumentTemplateInputSchema.parse(input);
  const baseKey = slugifyDocumentTemplateKey(parsed.title);
  let documentTemplateKey = baseKey;
  let suffix = 2;
  while (await getLatestDocumentTemplate(documentTemplateKey)) {
    const suffixText = `-${suffix}`;
    documentTemplateKey = `${baseKey.slice(0, 64 - suffixText.length)}${suffixText}`;
    suffix += 1;
    if (suffix > 1000) {
      throw new Error("Could not allocate a unique template key");
    }
  }

  const label = normalizeDocumentLabel(parsed.label ?? "", parsed.title);

  return insertVersion({
    documentTemplateKey,
    coverTypeId: parsed.coverTypeId,
    title: parsed.title,
    label,
    template: {
      basePdf: DOCUMENT_TEMPLATE_BLANK_BASE_PDF,
      schemas: [[]],
    },
    flowPushDown: null,
    mergeFields: [],
    isPublished: false,
    createdBy,
  });
}

/** Update cover type + title + label on every version row for a key. */
export async function updateDocumentTemplateMeta(
  input: z.infer<typeof updateDocumentTemplateMetaInputSchema>,
): Promise<void> {
  const parsed = updateDocumentTemplateMetaInputSchema.parse(input);
  const label = normalizeDocumentLabel(parsed.label, parsed.title);
  const db = getDb();
  await db
    .update(appDocumentTemplateVersion)
    .set({
      coverTypeId: parsed.coverTypeId,
      title: parsed.title,
      label,
    })
    .where(
      eq(
        appDocumentTemplateVersion.documentTemplateKey,
        parsed.documentTemplateKey,
      ),
    );
}

/** Persist templates on a blank A4 canvas (no static PDF background). */
function templateForStorage(
  template: z.infer<typeof pdfmeTemplateSchema>,
): Record<string, unknown> {
  return withBlankPageBackground(template as Template) as Record<
    string,
    unknown
  >;
}

/** Save a new draft version (not used for generation until published). */
export async function saveDocumentTemplateDraft(
  input: z.infer<typeof saveDocumentTemplateInputSchema>,
  createdBy = "",
): Promise<DocumentTemplateVersion> {
  const parsed = saveDocumentTemplateInputSchema.parse(input);
  const meta = await requireKeyMeta(parsed.documentTemplateKey);
  const latest = await getLatestDocumentTemplate(parsed.documentTemplateKey);

  return insertVersion({
    documentTemplateKey: parsed.documentTemplateKey,
    coverTypeId: meta.coverTypeId,
    title: meta.title,
    label: meta.label,
    template: templateForStorage(parsed.template),
    flowPushDown:
      parsed.flowPushDown === undefined
        ? ((latest?.flowPushDown as Record<string, unknown> | null) ?? null)
        : (parsed.flowPushDown as Record<string, unknown> | null),
    mergeFields:
      parsed.mergeFields && parsed.mergeFields.length > 0
        ? parsed.mergeFields
        : (latest?.mergeFields ?? []),
    isPublished: false,
    createdBy,
  });
}

/**
 * Autosave: update the latest unpublished draft in place so history is not
 * flooded. If the latest row is published (or missing), insert a new draft.
 */
export async function autosaveDocumentTemplateDraft(
  input: z.infer<typeof saveDocumentTemplateInputSchema>,
  createdBy = "",
): Promise<DocumentTemplateVersion> {
  const parsed = saveDocumentTemplateInputSchema.parse(input);
  const meta = await requireKeyMeta(parsed.documentTemplateKey);
  const latest = await getLatestDocumentTemplate(parsed.documentTemplateKey);

  const flowPushDown =
    parsed.flowPushDown === undefined
      ? ((latest?.flowPushDown as Record<string, unknown> | null) ?? null)
      : (parsed.flowPushDown as Record<string, unknown> | null);
  const mergeFields =
    parsed.mergeFields && parsed.mergeFields.length > 0
      ? parsed.mergeFields
      : (latest?.mergeFields ?? []);
  const template = templateForStorage(parsed.template);

  if (latest && !latest.isPublished) {
    const db = getDb();
    const [row] = await db
      .update(appDocumentTemplateVersion)
      .set({
        templateJson: template,
        flowPushDown,
        mergeFields,
        createdWhen: new Date(),
        createdBy,
      })
      .where(
        and(
          eq(
            appDocumentTemplateVersion.documentTemplateKey,
            parsed.documentTemplateKey,
          ),
          eq(appDocumentTemplateVersion.versionNumber, latest.versionNumber),
          eq(appDocumentTemplateVersion.isPublished, false),
        ),
      )
      .returning();

    if (!row) {
      throw new Error("Failed to autosave document template draft");
    }
    return rowToVersion(row);
  }

  return insertVersion({
    documentTemplateKey: parsed.documentTemplateKey,
    coverTypeId: meta.coverTypeId,
    title: meta.title,
    label: meta.label,
    template,
    flowPushDown,
    mergeFields,
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
  const meta = await requireKeyMeta(parsed.documentTemplateKey);
  const latest = await getLatestDocumentTemplate(parsed.documentTemplateKey);

  return insertVersion({
    documentTemplateKey: parsed.documentTemplateKey,
    coverTypeId: meta.coverTypeId,
    title: meta.title,
    label: meta.label,
    template: templateForStorage(parsed.template),
    flowPushDown:
      parsed.flowPushDown === undefined
        ? ((latest?.flowPushDown as Record<string, unknown> | null) ?? null)
        : (parsed.flowPushDown as Record<string, unknown> | null),
    mergeFields:
      parsed.mergeFields && parsed.mergeFields.length > 0
        ? parsed.mergeFields
        : (latest?.mergeFields ?? []),
    isPublished: true,
    createdBy,
  });
}

/** Publish an existing version by number (undo / restore). */
export async function publishDocumentTemplateVersion(
  documentTemplateKey: string,
  versionNumber: number,
  createdBy = "",
): Promise<DocumentTemplateVersion> {
  const db = getDb();
  const [target] = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(
      and(
        eq(appDocumentTemplateVersion.documentTemplateKey, documentTemplateKey),
        eq(appDocumentTemplateVersion.versionNumber, versionNumber),
      ),
    )
    .limit(1);
  if (!target) {
    throw new Error(
      `Version ${versionNumber} not found for ${documentTemplateKey}`,
    );
  }

  await db
    .update(appDocumentTemplateVersion)
    .set({ isPublished: false })
    .where(
      and(
        eq(appDocumentTemplateVersion.documentTemplateKey, documentTemplateKey),
        eq(appDocumentTemplateVersion.isPublished, true),
      ),
    );

  const [row] = await db
    .update(appDocumentTemplateVersion)
    .set({ isPublished: true })
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
 * If none exists, leave unpublished (generation fails closed).
 */
export async function undoDocumentTemplatePublish(
  documentTemplateKey: string,
  createdBy = "",
): Promise<{
  published: DocumentTemplateVersion | null;
  unpublished: boolean;
}> {
  const published = await getPublishedDocumentTemplate(documentTemplateKey);
  if (!published) {
    return { published: null, unpublished: true };
  }

  const db = getDb();
  const [previous] = await db
    .select()
    .from(appDocumentTemplateVersion)
    .where(
      and(
        eq(appDocumentTemplateVersion.documentTemplateKey, documentTemplateKey),
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
        eq(appDocumentTemplateVersion.documentTemplateKey, documentTemplateKey),
        eq(appDocumentTemplateVersion.isPublished, true),
      ),
    );

  if (!previous) {
    return { published: null, unpublished: true };
  }

  const restored = await publishDocumentTemplateVersion(
    documentTemplateKey,
    previous.versionNumber,
    createdBy,
  );
  return { published: restored, unpublished: false };
}

/** Remove all versions for a key. */
export async function deleteDocumentTemplate(
  documentTemplateKey: string,
): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(appDocumentTemplateVersion)
    .where(
      eq(appDocumentTemplateVersion.documentTemplateKey, documentTemplateKey),
    )
    .returning({
      id: appDocumentTemplateVersion.documentTemplateVersionId,
    });
  return deleted.length > 0;
}

/** @deprecated Use deleteDocumentTemplate. */
export async function resetDocumentTemplate(
  documentTemplateKey: string,
): Promise<boolean> {
  return deleteDocumentTemplate(documentTemplateKey);
}
