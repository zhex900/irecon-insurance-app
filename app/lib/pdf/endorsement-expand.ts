/**
 * Expand EndorsementSubject + EndorsementContent prototypes into one styled
 * pair per wording. Empty list → hide both.
 *
 * Sections stack with a fixed block gap. Bodies continue onto the next page
 * when tall — we do not bounce a whole endorsement just because its first
 * slice is tight. Layout and draw stop above the bottom margin.
 *
 * Plain text is painted by pdfme. Rich HTML is drawn via pdf-lib `drawOps`
 * after generate (pdfme cannot render tags / underline / mixed fonts).
 */
import { isBlankPdf, type Template } from "@pdfme/common";

import { estimateTextHeightMm } from "~/lib/pdf/flow-push-down";
import type { EndorsementRichDrawOp } from "~/lib/pdf/html-rich-text-draw";
import {
  endorsementReserveHeightForLinesMm,
  estimateWordingHtmlHeightMm,
  minEndorsementPaintBandMm,
  splitLineCountsIntoPages,
  wordingHtmlLineCount,
} from "~/lib/pdf/html-rich-text-lines";
import { ENDORSEMENTS_TABLE_FIELD } from "~/lib/pdf/merge-fields";
import {
  isWordingHtmlEmpty,
  looksLikeHtml,
  plainTextFromWordingHtml,
  plainTextToWordingHtml,
} from "~/lib/policies/wording/html";

export const ENDORSEMENT_SUBJECT_FIELD = "EndorsementSubject";
export const ENDORSEMENT_CONTENT_FIELD = "EndorsementContent";
/** Schema meta: mm between endorsement N and N+1 (editable in designer). */
export const ENDORSEMENT_BLOCK_GAP_KEY = "endorsementBlockGapMm";
export const DEFAULT_ENDORSEMENT_BLOCK_GAP_MM = 4;
/** Keep endorsement text above this margin (mm from page bottom). */
export const ENDORSEMENT_PAGE_BOTTOM_MARGIN_MM = 12;

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

function pageHeightMm(template: Template): number {
  const base = template.basePdf;
  if (isBlankPdf(base)) {
    const h = Number(base.height);
    return Number.isFinite(h) && h > 0 ? h : 297;
  }
  return 297;
}

/** Bottom margin (mm) used for endorsement packing — shared with pdf-lib draw. */
export function endorsementPageBottomMarginMm(template: Template): number {
  const base = template.basePdf;
  if (isBlankPdf(base) && Array.isArray(base.padding)) {
    const raw = Number(base.padding[2]);
    if (Number.isFinite(raw) && raw >= 0) return raw;
  }
  return ENDORSEMENT_PAGE_BOTTOM_MARGIN_MM;
}

/** Lowest Y (from page top) where endorsement content may still be placed. */
function pageBottomMm(template: Template): number {
  const height = pageHeightMm(template);
  return Math.max(40, height - endorsementPageBottomMarginMm(template));
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

type ToDrawOpOptions = {
  schema: SchemaLike;
  pageIndex: number;
  y: number;
  height: number;
  html: string;
  continuationTopMm: number;
  continuationHeightMm: number;
  continuationHeightsMm?: number[];
  pageBottomMarginMm?: number;
  pageLineBudgets?: number[];
};

function toDrawOp({
  schema,
  pageIndex,
  y,
  height,
  html,
  continuationTopMm,
  continuationHeightMm,
  continuationHeightsMm = [],
  pageBottomMarginMm = ENDORSEMENT_PAGE_BOTTOM_MARGIN_MM,
  pageLineBudgets = [],
}: ToDrawOpOptions): EndorsementRichDrawOp {
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
    continuationHeightMm,
    continuationHeightsMm,
    pageBottomMarginMm,
    pageLineBudgets,
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
  const pageBottomMarginMm = endorsementPageBottomMarginMm(template);
  const widthMm = Number(contentProto.width ?? 80);
  const bodyFont = Number(contentProto.fontSize ?? 9.5);
  const bodyLh = Number(contentProto.lineHeight ?? 1.25);
  const subjectWidthMm = Number(subjectProto.width ?? widthMm);
  const subjectFont = Number(subjectProto.fontSize ?? 11);
  const subjectLh = Number(subjectProto.lineHeight ?? 1.15);
  // Use the full band down to the page bottom limit (premium pdfme does the
  // same). Baseline inset is already covered by minEndorsementPaintBandMm /
  // line-height estimates — subtracting it again orphaned last lines.
  const usablePageH = Math.max(40, bottomLimit - contTopMm);

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!;
    const subjectIsHtml = looksLikeHtml(pair.subject);
    const contentIsHtml = looksLikeHtml(pair.content);
    // Measure plain via the HTML line pipeline so catalogue wordings reserve
    // the same gap before the next subject as rich HTML sections.
    const subjectHtml = subjectIsHtml
      ? pair.subject
      : plainTextToWordingHtml(pair.subject);
    const bodyHtml = contentIsHtml
      ? pair.content
      : plainTextToWordingHtml(pair.content);
    // Floor to one paintable line — a ~4.5mm designer subject box is shorter
    // than baseline+line, which made draw jump "Unsealed Roadworks" onto the
    // next page and overprint.
    const minSubjectPaintH = minEndorsementPaintBandMm(subjectFont, subjectLh);
    const minBodyPaintH = minEndorsementPaintBandMm(bodyFont, bodyLh);
    const subH = Math.max(
      subjectH,
      minSubjectPaintH,
      estimateWordingHtmlHeightMm(
        subjectHtml,
        subjectWidthMm,
        subjectFont,
        subjectLh,
      ),
    );
    // New page only when the subject (+ gap + a first line) will not fit —
    // never bounce a whole block because its body is tall (body continues).
    const headroomMm = subH + subjectToContentGap + Math.min(8, contentH);
    if (
      i > 0 &&
      (currentY > bottomLimit - 0.5 || currentY + headroomMm > bottomLimit)
    ) {
      pageIndex += 1;
      pages.splice(pageIndex, 0, []);
      currentY = contTopMm;
    }

    const subjectName = schemaName(ENDORSEMENT_SUBJECT_FIELD, i);
    const contentName = schemaName(ENDORSEMENT_CONTENT_FIELD, i);
    const subjectPlain = plainTextFromWordingHtml(pair.subject);
    const plainBody = plainTextFromWordingHtml(pair.content);
    const contentYPos = currentY + subH + subjectToContentGap;
    // Remaining space only (do not floor to designer prototype height).
    const roomOnPage = Math.max(4, bottomLimit - contentYPos);

    // Pack by how many wrap-lines fit in the band — not by mm remainders that
    // used to force a one-line orphan page while the previous page had space.
    const bodyLineCount = wordingHtmlLineCount(bodyHtml, widthMm, bodyFont);
    const lineChunks = splitLineCountsIntoPages(
      bodyLineCount,
      roomOnPage,
      usablePageH,
      bodyFont,
      bodyLh,
    );
    const minChunkH = contentIsHtml ? minBodyPaintH : contentH;
    const chunkHeights = lineChunks.map((n, idx) => {
      const maxH = idx === 0 ? roomOnPage : usablePageH;
      const need = endorsementReserveHeightForLinesMm(n, bodyFont, bodyLh);
      // Non-final chunks fill the page band so layout and draw share the same
      // floor (avoids an empty continuation page when draw packs one more line).
      if (idx < lineChunks.length - 1) return maxH;
      return Math.min(maxH, Math.max(minChunkH, need));
    });
    let plainChunks: string[] = [plainBody];
    if (!contentIsHtml) {
      plainChunks = splitPlainTextByHeight(
        plainBody,
        widthMm,
        bodyFont,
        bodyLh,
        roomOnPage,
        usablePageH,
      );
      // Keep page count aligned with line packing (drop empty trailing chunks).
      while (plainChunks.length > chunkHeights.length) plainChunks.pop();
      while (plainChunks.length < chunkHeights.length) plainChunks.push("");
    }
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

    const sectionPageIndex = pageIndex;
    const targetPage = pages[pageIndex]!;
    targetPage.push(subjectSchema, contentSchema);

    let blockBottom = contentYPos + firstBodyH;
    if (pageIndex === protoPageIndex) {
      lastBottomOnProtoPage = blockBottom;
    }

    // Continuation pages: reserve only the height actually used on each page.
    const overflowHeightsMm: number[] = [];
    for (let c = 1; c < chunkHeights.length; c++) {
      pageIndex += 1;
      pages.splice(pageIndex, 0, []);
      const chunkH = Math.min(
        usablePageH,
        Math.max(minChunkH, chunkHeights[c] ?? minChunkH),
      );
      overflowHeightsMm.push(chunkH);
      const contName = `${contentName}__cont${c}`;
      const contPaint = contentIsHtml ? "" : (plainChunks[c] ?? "");
      inputs[contName] = contPaint;
      pages[pageIndex]!.push(
        cloneSchema(contentProto, contName, contTopMm, chunkH, contPaint),
      );
      blockBottom = contTopMm + chunkH;
    }

    if (!isWordingHtmlEmpty(pair.subject) && subjectIsHtml) {
      drawOps.push(
        toDrawOp({
          schema: subjectSchema,
          pageIndex: sectionPageIndex,
          y: currentY,
          height: subH,
          html: pair.subject,
          continuationTopMm: contTopMm,
          continuationHeightMm: usablePageH,
          pageBottomMarginMm,
        }),
      );
    }
    if (!isWordingHtmlEmpty(pair.content) && contentIsHtml) {
      drawOps.push(
        toDrawOp({
          schema: contentSchema,
          pageIndex: sectionPageIndex,
          y: contentYPos,
          height: firstBodyH,
          html: pair.content,
          continuationTopMm: contTopMm,
          continuationHeightMm: usablePageH,
          continuationHeightsMm: overflowHeightsMm,
          pageBottomMarginMm,
          pageLineBudgets: lineChunks,
        }),
      );
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
