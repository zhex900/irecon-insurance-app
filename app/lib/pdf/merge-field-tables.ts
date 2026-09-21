import type { CarWording } from "~/lib/db/types";
import {
  canonicalMergeFieldName,
  resolveTableMergeInput,
} from "~/lib/pdf/merge-field-schemas";
import { normalizeCustomWordings } from "~/lib/policies/custom-wordings";
import { isWordingHtmlEmpty } from "~/lib/policies/wording/html";
import { referenceData as reference } from "~/lib/reference-data";
import { formatCurrency } from "~/lib/utils";

const STATE_BY_ID = new Map(
  reference.states.map((s) => [s.stateId, s.code] as const),
);

const COVER_BY_ID = new Map(
  reference.coverTypes.map((c) => [c.coverTypeId, c.name] as const),
);

const LIABILITY_BY_ID = new Map(
  reference.liabilityLimitBands.map((b) => [b.id, b.name] as const),
);

export function money(value: number | string | null | undefined) {
  if (value == null || value === "") return "N/A";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "N/A";
    if (/^n\/a$/i.test(trimmed)) return "N/A";
    // Only format bare / $ amounts — leave free text (e.g. "Not Insured") alone.
    const bare = trimmed.replace(/[$,\s]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(bare)) return trimmed;
    const parsed = Number(bare);
    if (Number.isNaN(parsed)) return trimmed;
    return formatCurrency(parsed);
  }
  if (Number.isNaN(value)) return "N/A";
  return formatCurrency(value);
}

export function yesNo(value: boolean | string | null | undefined) {
  if (value == null || value === "") return "";
  if (value === true || value === "true") return "Yes";
  if (value === false || value === "false") return "No";
  return "";
}

export function coverLabel(coverTypeId: number | string | null | undefined) {
  // Form <select> values are often strings; Map keys are numeric cover type ids.
  const id = Number(coverTypeId);
  if (!Number.isFinite(id) || id <= 0) return "";
  return COVER_BY_ID.get(id) ?? "";
}

export function stateCode(stateId: number) {
  return STATE_BY_ID.get(stateId) ?? "";
}

/** Dropdown label as shown on Limits (incl. "Not Insured") — no money transform. */
export function liabilityLabel(bandId: number | string | null | undefined) {
  // Form <select> values are strings; Map keys are numeric band ids.
  const id = Number(bandId);
  if (!Number.isFinite(id) || id <= 0) return "";
  return LIABILITY_BY_ID.get(id) ?? "";
}

/** pdfme table field used by Owner Builder ROA premium section. */
export const PREMIUM_CALCULATION_TABLE_FIELD = "PremiumCalculation";

/**
 * JSON `string[][]` of `[subject, content]` rows — data source for:
 * - Preferred: EndorsementSubject + EndorsementContent text pair (loops)
 * - Legacy: Table named `Endorsements`
 */
export const ENDORSEMENTS_TABLE_FIELD = "Endorsements";

type EndorsementPair = { subject: string; content: string };

/**
 * Endorsements rows = ticked Additional Wording (DB `car_wording` catalogue)
 * + free-form custom wordings. Shape is always `{ subject, content }`.
 */
export function collectEndorsementWordings(
  car: {
    selectedWordingIds?: number[] | null;
    customWordings?: Array<{
      id?: string;
      subject?: string | null;
      content?: string | null;
    }> | null;
    customWordingSubject?: string | null;
    customWordingContent?: string | null;
    customWordingSubject2?: string | null;
    customWordingContent2?: string | null;
  },
  wordingCatalogue: CarWording[] = [],
): EndorsementPair[] {
  const selected = new Set(
    (car.selectedWordingIds ?? [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id)),
  );

  const rows: EndorsementPair[] = [];

  // 1) Ticked fixed Additional Wording from catalogue
  for (const item of wordingCatalogue) {
    if (!selected.has(Number(item.carWordingId))) continue;
    const subject = item.subject ?? "";
    const content = item.content ?? "";
    if (isWordingHtmlEmpty(subject) && isWordingHtmlEmpty(content)) continue;
    rows.push({ subject, content });
  }

  // 2) Free-form custom wording ({ subject, content })
  const custom = normalizeCustomWordings(
    (car.customWordings ?? []).map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      subject: item.subject ?? "",
      content: item.content ?? "",
    })),
    {
      subject: car.customWordingSubject ?? undefined,
      content: car.customWordingContent ?? undefined,
      subject2: car.customWordingSubject2 ?? undefined,
      content2: car.customWordingContent2 ?? undefined,
    },
  );
  for (const item of custom) {
    const subject = item.subject ?? "";
    const content = item.content ?? "";
    if (isWordingHtmlEmpty(subject) && isWordingHtmlEmpty(content)) continue;
    rows.push({ subject, content });
  }

  return rows;
}

/** Build the Endorsements table body from policy additional wording. */
export function endorsementsTableContent(
  wordings:
    | Array<{ subject?: string | null; content?: string | null }>
    | null
    | undefined,
): string {
  const rows = (wordings ?? [])
    .map((item) => [String(item.subject ?? ""), String(item.content ?? "")])
    .filter(
      ([subject, content]) =>
        !isWordingHtmlEmpty(subject) || !isWordingHtmlEmpty(content),
    );
  // pdfme tables need at least one row; empty policy → blank pair.
  return JSON.stringify(rows.length > 0 ? rows : [["", ""]]);
}

const PT_TO_MM = 25.4 / 72;
/** A4 content area minus padding — pdfme cannot split a single table row across pages. */
const MAX_TABLE_ROW_HEIGHT_MM = 230;

type TableStyleLike = {
  fontSize?: number;
  lineHeight?: number;
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
};

function estimateCellHeightMm(
  text: string,
  widthMm: number,
  styles: TableStyleLike | undefined,
): number {
  const fontSize = Number(styles?.fontSize ?? 9);
  const lineHeight = Number(styles?.lineHeight ?? 1.25);
  const padTop = Number(styles?.padding?.top ?? 2);
  const padBottom = Number(styles?.padding?.bottom ?? 2);
  const padLeft = Number(styles?.padding?.left ?? 2);
  const padRight = Number(styles?.padding?.right ?? 2);
  // Conservative glyph width — underestimate chars/line so we overestimate height.
  const charWidthMm = Math.max(fontSize * 0.62 * PT_TO_MM, 1.45);
  const lineMm = fontSize * lineHeight * PT_TO_MM;
  const innerWidth = Math.max(widthMm - padLeft - padRight, charWidthMm);
  const cols = Math.max(1, Math.floor(innerWidth / charWidthMm));
  let lines = 0;
  for (const para of String(text ?? "").split("\n")) {
    const len = para.length;
    if (!len) {
      lines += 1;
      continue;
    }
    lines += Math.max(1, Math.ceil(len / cols));
  }
  // pdfme’s table measure runs ~1–2 lines short of the painted text — pad for that.
  const EXTRA_LINES = 2.5;
  return padTop + padBottom + Math.max(lineMm, (lines + EXTRA_LINES) * lineMm);
}

function parseTableBody(raw: string): string[][] {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [["", ""]];
    return parsed.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [""],
    );
  } catch {
    return [["", ""]];
  }
}

/**
 * Split a long text into chunks that each fit within `maxHeightMm` when wrapped
 * in a cell of `widthMm`. Keeps paragraph breaks where possible.
 */
function splitTextToFitCellHeight(
  text: string,
  widthMm: number,
  styles: TableStyleLike | undefined,
  maxHeightMm: number,
): string[] {
  const value = String(text ?? "");
  if (!value.trim()) return [value];
  if (estimateCellHeightMm(value, widthMm, styles) <= maxHeightMm) {
    return [value];
  }

  const paragraphs = value.split("\n");
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.length > 0) chunks.push(current);
    current = "";
  };

  for (const para of paragraphs) {
    const candidate = current.length > 0 ? `${current}\n${para}` : para;
    if (estimateCellHeightMm(candidate, widthMm, styles) <= maxHeightMm) {
      current = candidate;
      continue;
    }
    flush();
    if (estimateCellHeightMm(para, widthMm, styles) <= maxHeightMm) {
      current = para;
      continue;
    }
    // Hard-split an oversized paragraph by characters.
    const charWidthMm = Math.max(
      Number(styles?.fontSize ?? 9) * 0.62 * PT_TO_MM,
      1.45,
    );
    const padLeft = Number(styles?.padding?.left ?? 2);
    const padRight = Number(styles?.padding?.right ?? 2);
    const cols = Math.max(
      1,
      Math.floor(
        Math.max(widthMm - padLeft - padRight, charWidthMm) / charWidthMm,
      ),
    );
    const lineMm =
      Number(styles?.fontSize ?? 9) *
      Number(styles?.lineHeight ?? 1.25) *
      PT_TO_MM;
    const padV =
      Number(styles?.padding?.top ?? 2) + Number(styles?.padding?.bottom ?? 2);
    // Leave room for the same EXTRA_LINES slack used in estimateCellHeightMm.
    const maxLines = Math.max(1, Math.floor((maxHeightMm - padV) / lineMm) - 3);
    const chunkChars = Math.max(cols, maxLines * cols);
    for (let i = 0; i < para.length; i += chunkChars) {
      chunks.push(para.slice(i, i + chunkChars));
    }
    current = "";
  }
  flush();
  return chunks.length > 0 ? chunks : [value];
}

/**
 * pdfme cannot split one table row across pages. Long endorsement bodies are
 * broken into continuation rows (empty subject) so content is never clipped.
 */
export function splitEndorsementsTableBody(
  contentJson: string,
  schema: {
    width?: number;
    headWidthPercentages?: number[];
    bodyStyles?: TableStyleLike;
  },
  maxRowHeightMm = MAX_TABLE_ROW_HEIGHT_MM,
): string {
  const width = Math.max(Number(schema.width ?? 185), 20);
  const percentages =
    Array.isArray(schema.headWidthPercentages) &&
    schema.headWidthPercentages.length >= 2
      ? schema.headWidthPercentages
      : [30, 70];
  const contentWidth = (width * Number(percentages[1] ?? 70)) / 100;
  const body = parseTableBody(contentJson);
  const next: string[][] = [];

  for (const row of body) {
    const subject = String(row[0] ?? "");
    const content = String(row[1] ?? "");
    const chunks = splitTextToFitCellHeight(
      content,
      contentWidth,
      schema.bodyStyles,
      maxRowHeightMm,
    );
    chunks.forEach((chunk, index) => {
      next.push([index === 0 ? subject : "", chunk]);
    });
  }

  return JSON.stringify(next.length > 0 ? next : [["", ""]]);
}

/**
 * Grow a table schema's height to fit its JSON body (header + wrapped rows).
 * Used so Endorsements cells aren't clipped to the authored placeholder height.
 */
export function estimateTableHeightMm(
  schema: {
    width?: number;
    height?: number;
    showHead?: boolean;
    head?: string[];
    headWidthPercentages?: number[];
    headStyles?: TableStyleLike;
    bodyStyles?: TableStyleLike;
    content?: unknown;
  },
  contentJson?: string,
): number {
  const width = Math.max(Number(schema.width ?? 180), 20);
  const percentages =
    Array.isArray(schema.headWidthPercentages) &&
    schema.headWidthPercentages.length > 0
      ? schema.headWidthPercentages
      : [50, 50];
  const colWidths = percentages.map((p) => (width * Number(p)) / 100);

  const raw =
    typeof contentJson === "string"
      ? contentJson
      : typeof schema.content === "string"
        ? schema.content
        : "[]";
  const body = parseTableBody(raw);

  let total = 0;
  if (schema.showHead !== false && Array.isArray(schema.head)) {
    let headH = 0;
    schema.head.forEach((label, i) => {
      headH = Math.max(
        headH,
        estimateCellHeightMm(
          String(label ?? ""),
          colWidths[i] ?? width,
          schema.headStyles,
        ),
      );
    });
    total += headH;
  }
  for (const row of body) {
    let rowH = 0;
    row.forEach((cell, i) => {
      rowH = Math.max(
        rowH,
        estimateCellHeightMm(cell, colWidths[i] ?? width, schema.bodyStyles),
      );
    });
    total += rowH;
  }
  return Number(Math.max(total, Number(schema.height ?? 0), 12).toFixed(2));
}

/** Extra bottom padding (mm) so painted endorsement text isn’t clipped. */
const ENDORSEMENTS_EXTRA_BOTTOM_PADDING_MM = 6;

function withEndorsementsBodyPadding(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const bodyStyles = {
    ...((schema.bodyStyles as Record<string, unknown> | undefined) ?? {}),
  };
  const padding = {
    top: 2,
    right: 2,
    bottom: 2,
    left: 2,
    ...((bodyStyles.padding as Record<string, unknown> | undefined) ?? {}),
  };
  const bottom = Number(padding.bottom ?? 2);
  padding.bottom = bottom + ENDORSEMENTS_EXTRA_BOTTOM_PADDING_MM;
  bodyStyles.padding = padding;
  bodyStyles.verticalAlignment = "top";
  return { ...schema, bodyStyles };
}

/** Sync table `content` + grow `height` from merge inputs (Endorsements, etc.). */
export function syncTableSchemasToInputs<
  T extends { schemas: Array<Array<Record<string, unknown>>> },
>(template: T, inputs: Record<string, string>): T {
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      page.map((schema) => {
        if (schema.type !== "table" || typeof schema.name !== "string") {
          return schema;
        }
        const canonical = canonicalMergeFieldName(schema.name);
        const isEndorsements = canonical === ENDORSEMENTS_TABLE_FIELD;
        const baseSchema = isEndorsements
          ? withEndorsementsBodyPadding(schema)
          : schema;

        let resolved = resolveTableMergeInput(
          schema.name,
          typeof schema.content === "string" ? schema.content : "[]",
          inputs,
        );
        if (isEndorsements) {
          resolved = splitEndorsementsTableBody(
            resolved,
            baseSchema as Parameters<typeof splitEndorsementsTableBody>[1],
          );
        }
        inputs[schema.name] = resolved;
        if (isEndorsements) {
          inputs[ENDORSEMENTS_TABLE_FIELD] = resolved;
        }
        const height = estimateTableHeightMm(
          baseSchema as Parameters<typeof estimateTableHeightMm>[0],
          resolved,
        );
        return { ...baseSchema, content: resolved, height };
      }),
    ),
  };
}
