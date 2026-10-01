import type { CarWording } from "~/lib/db/types";
import {
  canonicalMergeFieldName,
  resolveTableMergeInput,
} from "~/lib/pdf/merge-field-schemas";
import { normalizeCustomWordings } from "~/lib/policies/custom-wordings";
import type { ActiveBandExcessAmounts } from "~/lib/policies/excesses";
import { resolveLiabilityLimitMillions } from "~/lib/policies/excesses";
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

const EXCESS_LIMIT_LABEL_10M = "$10,000,000 Limit of Liability";
const EXCESS_LIMIT_LABEL_20M = "$20,000,000 Limit of Liability";

/** Combined Section 2 limit excess label + value for `{ExcessLimitLabel} : {ExcessLimit}`. */
export function excessLimitMergeFields(
  liabilityLimitBand: unknown,
  activeExcess: Pick<ActiveBandExcessAmounts, "limit10M" | "limit20M">,
): { ExcessLimitLabel: string; ExcessLimit: string } {
  const limitMillions = resolveLiabilityLimitMillions(liabilityLimitBand);
  if (limitMillions === 10) {
    return {
      ExcessLimitLabel: EXCESS_LIMIT_LABEL_10M,
      ExcessLimit: money(activeExcess.limit10M),
    };
  }
  if (limitMillions === 20) {
    return {
      ExcessLimitLabel: EXCESS_LIMIT_LABEL_20M,
      ExcessLimit: money(activeExcess.limit20M),
    };
  }
  return {
    ExcessLimitLabel: "Not Applicable",
    ExcessLimit: "",
  };
}

/** pdfme table field used by Owner Builder ROA premium section. */
export const PREMIUM_CALCULATION_TABLE_FIELD = "PremiumCalculation";

/** Merge input: JSON `string[][]` of `[subject, content]` rows for endorsement expand. */
export const ENDORSEMENTS_TABLE_FIELD = "Endorsements";

export type EndorsementPair = { subject: string; content: string };

export type CarEndorsementSource = {
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
};

function pushEndorsementPair(
  rows: EndorsementPair[],
  subject: string,
  content: string,
) {
  if (isWordingHtmlEmpty(subject) && isWordingHtmlEmpty(content)) return;
  rows.push({ subject, content });
}

/** Ticked catalogue wordings in wizard checkbox order (then catalogue fallback). */
export function collectCatalogueEndorsementWordings(
  car: Pick<CarEndorsementSource, "selectedWordingIds">,
  wordingCatalogue: CarWording[] = [],
): EndorsementPair[] {
  const byId = new Map(
    wordingCatalogue.map((item) => [Number(item.carWordingId), item] as const),
  );
  const rows: EndorsementPair[] = [];
  const seen = new Set<number>();

  for (const rawId of car.selectedWordingIds ?? []) {
    const id = Number(rawId);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    const item = byId.get(id);
    if (!item) continue;
    pushEndorsementPair(rows, item.subject ?? "", item.content ?? "");
  }

  return rows;
}

/** Free-form additional wording from the policy wizard (after catalogue rows). */
export function collectCustomEndorsementWordings(
  car: CarEndorsementSource,
): EndorsementPair[] {
  const rows: EndorsementPair[] = [];
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
    pushEndorsementPair(rows, item.subject ?? "", item.content ?? "");
  }
  return rows;
}

/**
 * Endorsements rows = ticked Additional Wording (DB `car_wording` catalogue)
 * + free-form custom wordings. Shape is always `{ subject, content }`.
 */
export function collectEndorsementWordings(
  car: CarEndorsementSource,
  wordingCatalogue: CarWording[] = [],
): EndorsementPair[] {
  return [
    ...collectCatalogueEndorsementWordings(car, wordingCatalogue),
    ...collectCustomEndorsementWordings(car),
  ];
}

/** Build the `Endorsements` merge JSON from policy additional wording. */
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
 * Grow a table schema's height to fit its JSON body (header + wrapped rows).
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

/** Drop deprecated pdfme `table` schemas named `Endorsements` (use text pair expand). */
export function stripEndorsementsTableSchemas<
  T extends { schemas: Array<Array<Record<string, unknown>>> },
>(template: T): T {
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      page.filter((schema) => {
        if (schema.type !== "table" || typeof schema.name !== "string") {
          return true;
        }
        return (
          canonicalMergeFieldName(schema.name) !== ENDORSEMENTS_TABLE_FIELD
        );
      }),
    ),
  };
}

/** Sync table `content` + grow `height` from merge inputs (e.g. PremiumCalculation). */
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
        const resolved = resolveTableMergeInput(
          schema.name,
          typeof schema.content === "string" ? schema.content : "[]",
          inputs,
        );
        inputs[schema.name] = resolved;
        const height = estimateTableHeightMm(
          schema as Parameters<typeof estimateTableHeightMm>[0],
          resolved,
        );
        return { ...schema, content: resolved, height };
      }),
    ),
  };
}
