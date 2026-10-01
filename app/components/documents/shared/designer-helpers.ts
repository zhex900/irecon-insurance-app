import type { Template } from "@pdfme/common";
import type { DesignerSelectedSchema, DesignerSelection } from "@pdfme/ui";

import {
  DEFAULT_ENDORSEMENT_BLOCK_GAP_MM,
  ENDORSEMENT_BLOCK_GAP_KEY,
  ENDORSEMENT_CONTENT_FIELD,
  ENDORSEMENT_SUBJECT_FIELD,
} from "~/lib/pdf/endorsement-expand";
import { resolvePdfmeFontName } from "~/lib/pdf/font-config";
import {
  estimateTableHeightMm,
  stripEndorsementsTableSchemas,
} from "~/lib/pdf/merge-fields";
import type { BulkSchemaRef } from "~/lib/pdf/pdf-bulk-format";
import { withBlankPageBackground } from "~/lib/pdf/templates";

export type SchemaLike = {
  name?: string;
  type?: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  content?: string;
  [key: string]: unknown;
};

export type DesignerInstance = {
  getTemplate: () => Template;
  updateTemplate: (template: Template) => void;
  destroy: () => void;
  onChangeTemplate: (cb: (template: Template) => void) => void;
  onChangeSelection: (cb: (selection: DesignerSelection) => void) => void;
  getSelection: () => DesignerSelection;
  getPageCursor: () => number;
  getTotalPages: () => number;
  selectSchemas: (
    targets:
      | { name?: string; pageIndex?: number; schemaId?: string }
      | Array<{ name?: string; pageIndex?: number; schemaId?: string }>,
  ) => void;
};

/** Fill empty text schemas with sample content for Designer preview. */
function withPreviewContent(template: Template): Template {
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      page.map((schema) => {
        if (schema.type !== "text" && schema.type !== "multiVariableText") {
          return schema;
        }
        const content =
          typeof schema.content === "string" ? schema.content.trim() : "";
        if (content) return schema;
        return {
          ...schema,
          content: schema.name || "Text",
        };
      }),
    ),
  };
}

/** Ensure table schemas are tall enough for their JSON body. */
export function growTableHeightsFromContent(template: Template): Template {
  let changed = false;
  const schemas = template.schemas.map((page) =>
    page.map((schema) => {
      if (schema.type !== "table") return schema;
      const needed = estimateTableHeightMm(
        schema as Parameters<typeof estimateTableHeightMm>[0],
      );
      const current = Number(schema.height ?? 0);
      if (needed > current + 0.5) {
        changed = true;
        return { ...schema, height: needed };
      }
      return schema;
    }),
  );
  return changed ? { ...template, schemas } : template;
}

export function prepareDesignerTemplate(template: Template): Template {
  return growTableHeightsFromContent(
    withPreviewContent(
      withBlankPageBackground(
        stripEndorsementsTableSchemas(
          template as unknown as {
            schemas: Array<Array<Record<string, unknown>>>;
          },
        ) as Template,
      ),
    ),
  );
}

export function toBulkRefs(schemas: DesignerSelectedSchema[]): BulkSchemaRef[] {
  return schemas.map((schema) => ({
    name: schema.name,
    pageIndex: schema.pageIndex,
    schemaIndex: schema.schemaIndex,
  }));
}

export function uniqueSchemaName(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}__${n}`)) n += 1;
  return `${base}__${n}`;
}

export function nextFieldY(page: SchemaLike[]): number {
  let y = 15;
  for (const schema of page) {
    const bottom = Number(schema.position?.y ?? 0) + Number(schema.height ?? 0);
    if (bottom + 2 > y) y = bottom + 2;
  }
  return y > 275 ? 15 : Number(y.toFixed(2));
}

export function createTextMergeSchema(name: string, y: number): SchemaLike {
  const canonical = name.replace(/__\d+$/, "");
  const isEndorsementSubject = canonical === ENDORSEMENT_SUBJECT_FIELD;
  const isEndorsementContent = canonical === ENDORSEMENT_CONTENT_FIELD;
  const isEndorsement = isEndorsementSubject || isEndorsementContent;

  return {
    name,
    type: "text",
    position: { x: 12, y },
    width: isEndorsement ? 185 : 80,
    height: isEndorsementContent ? 14 : isEndorsementSubject ? 6 : 5,
    content: isEndorsementSubject
      ? "Sample endorsement"
      : isEndorsementContent
        ? "It is hereby noted and agreed that this policy is endorsed as follows. Long wording wraps using this field’s format."
        : `{${canonical}}`,
    fontSize: isEndorsementSubject ? 11 : 9.5,
    fontColor: "#111111",
    fontName: resolvePdfmeFontName(
      "Roboto",
      isEndorsementSubject ? "700" : "400",
      "normal",
    ),
    lineHeight: isEndorsementContent ? 1.25 : 1.15,
    backgroundColor: "",
    verticalAlignment: isEndorsement ? "top" : "middle",
    overflow: "visible",
    readOnly: false,
    ...(isEndorsementSubject
      ? { [ENDORSEMENT_BLOCK_GAP_KEY]: DEFAULT_ENDORSEMENT_BLOCK_GAP_MM }
      : {}),
  };
}

export type TableColumnDraft = { head: string; widthPct: string };

export function readTableColumns(schema: unknown): TableColumnDraft[] {
  const s = schema as {
    head?: unknown;
    headWidthPercentages?: unknown;
  };
  const heads = Array.isArray(s.head) ? s.head.map((h) => String(h ?? "")) : [];
  const widths = Array.isArray(s.headWidthPercentages)
    ? s.headWidthPercentages.map((w) => Number(w))
    : [];
  if (heads.length === 0) return [{ head: "Column 1", widthPct: "100" }];
  return heads.map((head, i) => ({
    head,
    widthPct: String(
      Number.isFinite(widths[i]) ? Number(widths[i]!.toFixed(1)) : 0,
    ),
  }));
}

export function normalizeWidthPercentages(raw: number[]): number[] {
  const cleaned = raw.map((n) => (Number.isFinite(n) && n > 0 ? n : 1));
  const sum = cleaned.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const even = 100 / Math.max(cleaned.length, 1);
    return cleaned.map(() => Number(even.toFixed(2)));
  }
  return cleaned.map((n) => Number(((n / sum) * 100).toFixed(2)));
}

export function parseTableBodyRows(content: unknown): string[][] {
  if (typeof content !== "string") return [[""]];
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [[""]];
    return parsed.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [""],
    );
  } catch {
    return [[""]];
  }
}

/**
 * Client-only pdfme Designer. Dynamic-imports `@pdfme/ui` so SSR never loads it.
 */
