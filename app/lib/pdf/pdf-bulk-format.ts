import type { Template } from "@pdfme/common";

import {
  parsePdfmeFontName,
  pdfmeFontVariantsForFamily,
  type PdfmeFontWeight,
  resolvePdfmeFontName,
} from "~/lib/pdf/font-config";

export type BulkSchemaRef = {
  name: string;
  pageIndex: number;
  schemaIndex: number;
};

type MutableSchema = Record<string, unknown> & {
  name?: string;
  type?: string;
  width?: number;
  height?: number;
  position?: { x?: number; y?: number };
  fontName?: string;
  fontVariants?: { bold?: string; italic?: string; boldItalic?: string };
  backgroundColor?: string;
  color?: string;
  opacity?: number;
};

export type ZOrderDirection = "forward" | "backward" | "front" | "back";

function asMutable(schema: unknown): MutableSchema {
  return schema as MutableSchema;
}

function getY(schema: MutableSchema): number {
  const y = schema.position?.y;
  return typeof y === "number" && Number.isFinite(y) ? y : 0;
}

function setY(schema: MutableSchema, y: number) {
  schema.position = {
    ...(schema.position ?? {}),
    x: typeof schema.position?.x === "number" ? schema.position.x : 0,
    y,
  };
}

function isTextLike(schema: MutableSchema): boolean {
  return schema.type === "text" || schema.type === "multiVariableText";
}

function cloneTemplate(template: Template): Template {
  return structuredClone(template) as Template;
}

function applyToRefs(
  template: Template,
  refs: BulkSchemaRef[],
  mutate: (schema: MutableSchema) => void,
): Template {
  const next = cloneTemplate(template);
  for (const ref of refs) {
    const page = next.schemas[ref.pageIndex];
    if (!page?.[ref.schemaIndex]) continue;
    mutate(asMutable(page[ref.schemaIndex]));
  }
  return next;
}

/** Set font weight (bold/regular) on all text-like selected schemas. */
export function applyFontWeightToSchemas(
  template: Template,
  refs: BulkSchemaRef[],
  weight: PdfmeFontWeight,
): Template {
  return applyToRefs(template, refs, (schema) => {
    if (!isTextLike(schema)) return;
    const { family, style } = parsePdfmeFontName(schema.fontName);
    schema.fontName = resolvePdfmeFontName(family, weight, style);
    schema.fontVariants = pdfmeFontVariantsForFamily(family);
  });
}

/** Set the same height (mm) on all selected schemas. */
export function applyHeightToSchemas(
  template: Template,
  refs: BulkSchemaRef[],
  heightMm: number,
): Template {
  const height = Math.max(0.5, heightMm);
  return applyToRefs(template, refs, (schema) => {
    schema.height = height;
  });
}

/**
 * Set Y positions with a fixed step from the first selected element
 * (sorted by current Y on each page). Example: first Y=10, gap=10 → 10, 20, 30.
 */
export function spaceSchemasVertically(
  template: Template,
  refs: BulkSchemaRef[],
  yGapMm: number,
): Template {
  if (refs.length < 2) return template;

  const byPage = new Map<number, BulkSchemaRef[]>();
  for (const ref of refs) {
    const list = byPage.get(ref.pageIndex) ?? [];
    list.push(ref);
    byPage.set(ref.pageIndex, list);
  }

  const next = cloneTemplate(template);
  const step = Math.max(0, yGapMm);

  for (const [, pageRefs] of byPage) {
    if (pageRefs.length < 2) continue;
    const page = next.schemas[pageRefs[0]!.pageIndex];
    if (!page) continue;

    const ordered = [...pageRefs].sort((a, b) => {
      const ya = getY(asMutable(page[a.schemaIndex]));
      const yb = getY(asMutable(page[b.schemaIndex]));
      if (ya !== yb) return ya - yb;
      return a.schemaIndex - b.schemaIndex;
    });

    const firstY = getY(asMutable(page[ordered[0]!.schemaIndex]));
    for (let i = 1; i < ordered.length; i++) {
      const curr = asMutable(page[ordered[i]!.schemaIndex]);
      if (!curr) continue;
      setY(curr, firstY + step * i);
    }
  }

  return next;
}

/** Resolve current indices by name (schemaIndex from selection can go stale). */
function resolveIndicesOnPage(
  page: Template["schemas"][number],
  refs: BulkSchemaRef[],
): number[] {
  const indices: number[] = [];
  const seen = new Set<number>();
  for (const ref of refs) {
    let index: number;
    if (
      typeof ref.schemaIndex === "number" &&
      page[ref.schemaIndex] &&
      asMutable(page[ref.schemaIndex]).name === ref.name
    ) {
      index = ref.schemaIndex;
    } else {
      index = page.findIndex((schema) => asMutable(schema).name === ref.name);
    }
    if (index < 0 || seen.has(index)) continue;
    seen.add(index);
    indices.push(index);
  }
  return indices.sort((a, b) => a - b);
}

/**
 * Change paint order for selected schemas on each page.
 * Later schemas in the page array draw on top in pdfme.
 */
export function moveSchemasZOrder(
  template: Template,
  refs: BulkSchemaRef[],
  direction: ZOrderDirection,
): Template {
  if (refs.length === 0) return template;

  const byPage = new Map<number, BulkSchemaRef[]>();
  for (const ref of refs) {
    const list = byPage.get(ref.pageIndex) ?? [];
    list.push(ref);
    byPage.set(ref.pageIndex, list);
  }

  const next = cloneTemplate(template);

  for (const [pageIndex, pageRefs] of byPage) {
    const page = next.schemas[pageIndex];
    if (!page || page.length < 2) continue;

    const unique = resolveIndicesOnPage(page, pageRefs);
    if (unique.length === 0) continue;

    if (direction === "front" || direction === "back") {
      const moving = unique.map((i) => page[i]!);
      const remaining = page.filter((_, i) => !unique.includes(i));
      next.schemas[pageIndex] =
        direction === "front"
          ? [...remaining, ...moving]
          : [...moving, ...remaining];
      continue;
    }

    const selected = new Set(unique);
    if (direction === "forward") {
      const sorted = [...selected].sort((a, b) => b - a);
      for (const i of sorted) {
        if (i >= page.length - 1 || selected.has(i + 1)) continue;
        const tmp = page[i]!;
        page[i] = page[i + 1]!;
        page[i + 1] = tmp;
        selected.delete(i);
        selected.add(i + 1);
      }
    } else {
      const sorted = [...selected].sort((a, b) => a - b);
      for (const i of sorted) {
        if (i <= 0 || selected.has(i - 1)) continue;
        const tmp = page[i]!;
        page[i] = page[i - 1]!;
        page[i - 1] = tmp;
        selected.delete(i);
        selected.add(i - 1);
      }
    }
  }

  return next;
}

/** Clear fill / background on selected schemas (text + shapes). */
export function applyTransparentBackground(
  template: Template,
  refs: BulkSchemaRef[],
): Template {
  return applyToRefs(template, refs, (schema) => {
    if (
      isTextLike(schema) ||
      schema.type === "list" ||
      schema.type === "table"
    ) {
      schema.backgroundColor = "";
      return;
    }
    if (schema.type === "rectangle" || schema.type === "ellipse") {
      schema.color = "";
      return;
    }
    if (typeof schema.backgroundColor === "string") {
      schema.backgroundColor = "";
    }
  });
}
