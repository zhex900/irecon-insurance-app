/**
 * Expand EndorsementSubject + EndorsementContent prototypes into one styled
 * pair per wording. Empty list → hide both. Overflow → whole block on next page.
 *
 * Plain text is painted by pdfme. Rich HTML is drawn via pdf-lib `drawOps`
 * after generate (pdfme cannot render tags / underline / mixed fonts).
 */
import { isBlankPdf, type Template } from "@pdfme/common";
import { estimateTextHeightMm } from "~/lib/pdf/flow-push-down";
import type { EndorsementRichDrawOp } from "~/lib/pdf/html-rich-text-draw";
import {
  estimateWordingHtmlHeightMm,
  splitHeightIntoPageChunks,
} from "~/lib/pdf/html-rich-text-lines";
import { ENDORSEMENTS_TABLE_FIELD } from "~/lib/pdf/merge-fields";
import {
  isWordingHtmlEmpty,
  looksLikeHtml,
  plainTextFromWordingHtml,
  wordingHtmlToEstimateText,
} from "~/lib/wording/html";

export const ENDORSEMENT_SUBJECT_FIELD = "EndorsementSubject";
export const ENDORSEMENT_CONTENT_FIELD = "EndorsementContent";
/** Schema meta: mm between endorsement N and N+1 (editable in designer). */
export const ENDORSEMENT_BLOCK_GAP_KEY = "endorsementBlockGapMm";
export const DEFAULT_ENDORSEMENT_BLOCK_GAP_MM = 4;

type SchemaLike = {
  name?: string;
  type?: string;
  position?: { x?: number; y?: number };
  width?: number;
  height?: number;
  fontSize?: number;
  lineHeight?: number;
  fontName?: string;
  fontColor?: string;
  verticalAlignment?: string;
  endorsementBlockGapMm?: number;
  [key: string]: unknown;
};

type EndorsementPair = { subject: string; content: string };

function canonicalName(name: string): string {
  return name
    .replace(/__\d+$/, "")
    .replace(/(?: copy)+(?:\s+\d+)?$/i, "")
    .trim();
}

function schemaName(base: string, index: number): string {
  return index === 0 ? base : `${base}__${index + 1}`;
}

function readBlockGapMm(schema: SchemaLike | undefined): number {
  const raw = Number(schema?.[ENDORSEMENT_BLOCK_GAP_KEY]);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return DEFAULT_ENDORSEMENT_BLOCK_GAP_MM;
}

/** Parse endorsement rows from the Endorsements table JSON input. */
export function parseEndorsementPairsFromInputs(
  inputs: Record<string, string>,
): EndorsementPair[] {
  const raw = inputs[ENDORSEMENTS_TABLE_FIELD] ?? "";
  if (!raw.trim()) {
    const subject = inputs[ENDORSEMENT_SUBJECT_FIELD] ?? "";
    const content = inputs[ENDORSEMENT_CONTENT_FIELD] ?? "";
    return !isWordingHtmlEmpty(subject) || !isWordingHtmlEmpty(content)
      ? [{ subject, content }]
      : [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!Array.isArray(row)) return { subject: "", content: "" };
        return {
          subject: String(row[0] ?? ""),
          content: String(row[1] ?? ""),
        };
      })
      .filter(
        (row) =>
          !isWordingHtmlEmpty(row.subject) || !isWordingHtmlEmpty(row.content),
      );
  } catch {
    return [];
  }
}

function pageBottomMm(template: Template): number {
  const base = template.basePdf;
  if (isBlankPdf(base)) {
    const padBottom = Array.isArray(base.padding)
      ? Number(base.padding[2])
      : 10;
    return Math.max(
      40,
      Number(base.height) - (Number.isFinite(padBottom) ? padBottom : 10),
    );
  }
  return 290;
}

function pageTopMm(template: Template): number {
  const base = template.basePdf;
  if (isBlankPdf(base)) {
    const padTop = Array.isArray(base.padding) ? Number(base.padding[0]) : 10;
    return Number.isFinite(padTop) ? padTop : 10;
  }
  return 15;
}

/**
 * Overflow / inserted pages are blank (no letterhead). Start content near the
 * top of those pages rather than the prototype EndorsementSubject y.
 */
function overflowTopMm(template: Template): number {
  const base = template.basePdf;
  if (isBlankPdf(base)) return pageTopMm(template);
  return 10;
}

function cloneSchema(
  proto: SchemaLike,
  name: string,
  y: number,
  height: number,
  content: string,
): SchemaLike {
  const { endorsementBlockGapMm: _gap, ...rest } = proto;
  return {
    ...rest,
    name,
    content,
    position: {
      x: Number(proto.position?.x ?? 12),
      y: Number(y.toFixed(2)),
    },
    height: Number(height.toFixed(2)),
    verticalAlignment: "top",
    overflow: "visible",
  };
}

function estimateSchemaHeight(schema: SchemaLike, htmlOrText: string): number {
  return estimateTextHeightMm(
    wordingHtmlToEstimateText(htmlOrText),
    Number(schema.width ?? 80),
    Number(schema.fontSize ?? 9.5),
    Number(schema.lineHeight ?? 1.25),
  );
}

/** Split plain text into page-height chunks so tall wordings still paint via pdfme. */
function splitPlainTextByHeight(
  text: string,
  widthMm: number,
  fontSizePt: number,
  lineHeight: number,
  firstMaxMm: number,
  pageMaxMm: number,
): string[] {
  const raw = String(text ?? "").trim();
  if (!raw) return [""];
  const paragraphs = raw.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];
  let limit = Math.max(20, firstMaxMm);

  const heightOf = (parts: string[]) =>
    estimateTextHeightMm(parts.join("\n"), widthMm, fontSizePt, lineHeight);

  for (const para of paragraphs) {
    const trial = [...current, para];
    if (current.length > 0 && heightOf(trial) > limit) {
      chunks.push(current.join("\n"));
      current = [para];
      limit = Math.max(20, pageMaxMm);
    } else {
      current = trial;
    }
  }
  if (current.length > 0) chunks.push(current.join("\n"));
  return chunks.length > 0 ? chunks : [""];
}

function toDrawOp(
  schema: SchemaLike,
  pageIndex: number,
  y: number,
  height: number,
  html: string,
  continuationTopMm: number,
): EndorsementRichDrawOp {
  return {
    pageIndex,
    xMm: Number(schema.position?.x ?? 12),
    yMm: Number(y.toFixed(2)),
    widthMm: Number(schema.width ?? 80),
    heightMm: Number(height.toFixed(2)),
    html,
    fontSizePt: Number(schema.fontSize ?? 9.5),
    fontName: String(schema.fontName ?? "Roboto"),
    fontColor: String(schema.fontColor ?? "#111111"),
    lineHeight: Number(schema.lineHeight ?? 1.25),
    continuationTopMm,
  };
}

/**
 * If the page has EndorsementSubject + EndorsementContent prototypes, expand
 * them into one pair per wording. Mutates `inputs` with per-instance values.
 * Clears pdfme content (rich HTML is drawn via returned `drawOps`).
 */
export function expandEndorsementPairSchemas(
  template: Template,
  inputs: Record<string, string>,
  drawOps: EndorsementRichDrawOp[] = [],
): Template {
  const pairs = parseEndorsementPairsFromInputs(inputs);
  const pages = template.schemas.map((page) =>
    page.map((schema) => {
      const s = schema as SchemaLike;
      return {
        ...s,
        position: { ...(s.position ?? {}) },
      };
    }),
  ) as SchemaLike[][];

  let protoPageIndex = -1;
  let subjectProto: SchemaLike | undefined;
  let contentProto: SchemaLike | undefined;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex]!;
    const subject = page.find(
      (s) =>
        s.type === "text" &&
        canonicalName(String(s.name ?? "")) === ENDORSEMENT_SUBJECT_FIELD &&
        !/__\d+$/.test(String(s.name ?? "")),
    );
    const content = page.find(
      (s) =>
        s.type === "text" &&
        canonicalName(String(s.name ?? "")) === ENDORSEMENT_CONTENT_FIELD &&
        !/__\d+$/.test(String(s.name ?? "")),
    );
    if (subject && content) {
      protoPageIndex = pageIndex;
      subjectProto = subject;
      contentProto = content;
      break;
    }
  }

  if (protoPageIndex < 0 || !subjectProto || !contentProto) {
    return template;
  }

  const subjectY = Number(subjectProto.position?.y ?? 0);
  const subjectH = Number(subjectProto.height ?? 5);
  const contentY = Number(contentProto.position?.y ?? subjectY + subjectH + 2);
  const contentH = Number(contentProto.height ?? 8);
  const subjectToContentGap = Math.max(0, contentY - subjectY - subjectH);
  const blockGapMm = readBlockGapMm(subjectProto);
  const originalBlockBottom = contentY + contentH;
  const bottomLimit = pageBottomMm(template);
  const topMargin = pageTopMm(template);

  const protoPage = pages[protoPageIndex]!;
  const followers = protoPage.filter((s) => {
    const name = String(s.name ?? "");
    const canon = canonicalName(name);
    if (
      canon === ENDORSEMENT_SUBJECT_FIELD ||
      canon === ENDORSEMENT_CONTENT_FIELD
    ) {
      return false;
    }
    const y = Number(s.position?.y ?? 0);
    return y >= originalBlockBottom - 0.5;
  });

  // Strip prototypes (and any prior __N clones) from the source page.
  pages[protoPageIndex] = protoPage.filter((s) => {
    const canon = canonicalName(String(s.name ?? ""));
    return (
      canon !== ENDORSEMENT_SUBJECT_FIELD && canon !== ENDORSEMENT_CONTENT_FIELD
    );
  });

  if (pairs.length === 0) {
    // Hide both fields — prototypes already removed.
    return { ...template, schemas: pages as Template["schemas"] };
  }

  // Clear legacy scalar inputs; per-instance keys are written below.
  delete inputs[ENDORSEMENT_SUBJECT_FIELD];
  delete inputs[ENDORSEMENT_CONTENT_FIELD];
  for (const key of Object.keys(inputs)) {
    if (
      key.startsWith(`${ENDORSEMENT_SUBJECT_FIELD}__`) ||
      key.startsWith(`${ENDORSEMENT_CONTENT_FIELD}__`)
    ) {
      delete inputs[key];
    }
  }

  let pageIndex = protoPageIndex;
  let currentY = subjectY;
  let lastBottomOnProtoPage = subjectY;
  const contTopMm = overflowTopMm(template);
  const widthMm = Number(contentProto.width ?? 80);
  const bodyFont = Number(contentProto.fontSize ?? 9.5);
  const bodyLh = Number(contentProto.lineHeight ?? 1.25);
  const subjectWidthMm = Number(subjectProto.width ?? widthMm);
  const subjectFont = Number(subjectProto.fontSize ?? 11);
  const subjectLh = Number(subjectProto.lineHeight ?? 1.15);

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!;
    const subjectIsHtml = looksLikeHtml(pair.subject);
    const contentIsHtml = looksLikeHtml(pair.content);
    const subH = Math.max(
      subjectH,
      subjectIsHtml
        ? estimateWordingHtmlHeightMm(
            pair.subject,
            subjectWidthMm,
            subjectFont,
            subjectLh,
          )
        : estimateSchemaHeight(subjectProto, pair.subject),
    );
    // HTML: use measured wrap height only — do not floor to the prototype
    // box height or the next endorsement (e.g. Heritage) sits too low.
    const totalBodyH = contentIsHtml
      ? Math.max(
          4,
          estimateWordingHtmlHeightMm(pair.content, widthMm, bodyFont, bodyLh),
        )
      : Math.max(contentH, estimateSchemaHeight(contentProto, pair.content));
    // For page-fit, only the first page slice matters; tall HTML continues.
    const firstSliceH = Math.min(
      totalBodyH,
      Math.max(40, bottomLimit - topMargin),
    );
    const blockH = subH + subjectToContentGap + firstSliceH;

    const fits =
      currentY + blockH <= bottomLimit ||
      // Single block taller than a page: still place (overlay continues).
      currentY <= topMargin + 0.5;

    if (!fits) {
      // Whole endorsement moves to a new page inserted after the current one.
      pageIndex += 1;
      pages.splice(pageIndex, 0, []);
      currentY = contTopMm;
    }

    const subjectName = schemaName(ENDORSEMENT_SUBJECT_FIELD, i);
    const contentName = schemaName(ENDORSEMENT_CONTENT_FIELD, i);
    const subjectPlain = plainTextFromWordingHtml(pair.subject);
    const plainBody = plainTextFromWordingHtml(pair.content);
    const contentYPos = currentY + subH + subjectToContentGap;
    const usablePageH = Math.max(40, bottomLimit - contTopMm);
    const roomOnPage = Math.max(contentH, bottomLimit - contentYPos);

    // HTML: pack from real wrap-line heights so the next endorsement sits
    // under the last ink (not under an overestimated plain-text box).
    // Plain: keep pdfme chunk splitting for multi-page text paint.
    let chunkHeights: number[];
    let plainChunks: string[] = [plainBody];
    if (contentIsHtml) {
      chunkHeights = splitHeightIntoPageChunks(
        totalBodyH,
        roomOnPage,
        usablePageH,
      );
    } else {
      plainChunks = splitPlainTextByHeight(
        plainBody,
        widthMm,
        bodyFont,
        bodyLh,
        roomOnPage,
        usablePageH,
      );
      chunkHeights = plainChunks.map((chunk, idx) =>
        Math.min(
          idx === 0 ? roomOnPage : usablePageH,
          Math.max(
            contentH,
            estimateTextHeightMm(chunk, widthMm, bodyFont, bodyLh),
          ),
        ),
      );
    }
    const minChunkH = contentIsHtml ? 4 : contentH;
    const firstBodyH = Math.min(
      Math.max(minChunkH, chunkHeights[0] ?? minChunkH),
      roomOnPage,
    );
    const firstPlain = plainChunks[0] ?? "";
    const subjectPaint = subjectIsHtml ? "" : subjectPlain;
    const firstPaint = contentIsHtml ? "" : firstPlain;

    inputs[subjectName] = subjectPaint;
    inputs[contentName] = firstPaint;

    const subjectSchema = cloneSchema(
      subjectProto,
      subjectName,
      currentY,
      subH,
      subjectPaint,
    );
    const contentSchema = cloneSchema(
      contentProto,
      contentName,
      contentYPos,
      firstBodyH,
      firstPaint,
    );

    if (!isWordingHtmlEmpty(pair.subject) && subjectIsHtml) {
      drawOps.push(
        toDrawOp(
          subjectSchema,
          pageIndex,
          currentY,
          subH,
          pair.subject,
          contTopMm,
        ),
      );
    }
    if (!isWordingHtmlEmpty(pair.content) && contentIsHtml) {
      // Full HTML on the first content box; overlay paginates across pages.
      drawOps.push(
        toDrawOp(
          contentSchema,
          pageIndex,
          contentYPos,
          firstBodyH,
          pair.content,
          contTopMm,
        ),
      );
    }

    const targetPage = pages[pageIndex]!;
    targetPage.push(subjectSchema, contentSchema);

    let blockBottom = contentYPos + firstBodyH;
    if (pageIndex === protoPageIndex) {
      lastBottomOnProtoPage = blockBottom;
    }

    // Continuation pages: reserve only the height actually used on each page.
    for (let c = 1; c < chunkHeights.length; c++) {
      pageIndex += 1;
      pages.splice(pageIndex, 0, []);
      const chunkH = Math.min(
        usablePageH,
        Math.max(minChunkH, chunkHeights[c] ?? minChunkH),
      );
      const contName = `${contentName}__cont${c}`;
      const contPaint = contentIsHtml ? "" : (plainChunks[c] ?? "");
      inputs[contName] = contPaint;
      pages[pageIndex]!.push(
        cloneSchema(contentProto, contName, contTopMm, chunkH, contPaint),
      );
      blockBottom = contTopMm + chunkH;
    }

    currentY = blockBottom + blockGapMm;
  }

  // Push fields that sat below the original pair on the prototype page.
  const delta = lastBottomOnProtoPage - originalBlockBottom;
  if (delta > 0.4) {
    for (const follower of followers) {
      const name = String(follower.name ?? "");
      const onPage = pages[protoPageIndex]!.find((s) => s.name === name);
      if (!onPage?.position) continue;
      onPage.position.y = Number(
        (Number(onPage.position.y) + delta).toFixed(2),
      );
    }
  }

  return { ...template, schemas: pages as Template["schemas"] };
}

/** Persist block gap on the Subject prototype schema. */
export function setEndorsementBlockGapMm(
  template: Template,
  gapMm: number,
): Template {
  const gap =
    Number.isFinite(gapMm) && gapMm >= 0
      ? gapMm
      : DEFAULT_ENDORSEMENT_BLOCK_GAP_MM;
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      page.map((schema) => {
        const s = schema as SchemaLike;
        if (
          s.type === "text" &&
          canonicalName(String(s.name ?? "")) === ENDORSEMENT_SUBJECT_FIELD &&
          !/__\d+$/.test(String(s.name ?? ""))
        ) {
          return { ...schema, [ENDORSEMENT_BLOCK_GAP_KEY]: gap };
        }
        return schema;
      }),
    ),
  };
}

export function readEndorsementBlockGapMm(template: Template): number {
  for (const page of template.schemas) {
    for (const schema of page) {
      const s = schema as SchemaLike;
      if (
        s.type === "text" &&
        canonicalName(String(s.name ?? "")) === ENDORSEMENT_SUBJECT_FIELD &&
        !/__\d+$/.test(String(s.name ?? ""))
      ) {
        return readBlockGapMm(s);
      }
    }
  }
  return DEFAULT_ENDORSEMENT_BLOCK_GAP_MM;
}
