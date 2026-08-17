/**
 * Parse Additional Wording HTML into wrapped draw lines / height estimates.
 * No pdf-lib or font-file imports — safe for endorsement expand + designer.
 */
import type { PdfmeFontFamily } from "~/lib/pdf/font-config";
import {
  endorsementReserveHeightForLinesMm,
  heuristicTextWidthPt,
} from "~/lib/pdf/html-rich-text-geometry";
import {
  defaultListStyleForTag,
  formatWordingListMarker,
  isWordingListStyle,
  looksLikeHtml,
  normalizeFontFamily,
  plainTextToWordingHtml,
  sanitizeWordingHtml,
  type WordingListStyle,
} from "~/lib/policies/wording/html";

import {
  cloneStyle,
  decodeEntities,
  parseStyleDecls,
  readAttr,
} from "./html-utils";

const MM_TO_PT = 72 / 25.4;

export type RichTextRunStyle = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSizePt: number;
  family: PdfmeFontFamily;
};

type TextRun = {
  text: string;
  style: RichTextRunStyle;
};

export type DrawLine = {
  runs: TextRun[];
  indentPx: number;
  marker?: string;
  /** Same <ol>/<ul> instance — used to size/align the shared marker column. */
  listGroupId?: number;
};

export type HtmlToDrawLinesOptions = {
  /**
   * Keep font family + size locked to the schema (EndorsementSubject /
   * EndorsementContent). Still honours bold / italic / underline from HTML.
   */
  lockSchemaMetrics?: boolean;
};

/** Parse sanitized wording HTML into wrapped draw lines. */
export function htmlToDrawLines(
  html: string,
  base: Omit<RichTextRunStyle, "bold" | "italic" | "underline"> & {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  },
  widthMm: number,
  measure: (text: string, style: RichTextRunStyle) => number,
  options?: HtmlToDrawLinesOptions,
): DrawLine[] {
  const lockSchemaMetrics = Boolean(options?.lockSchemaMetrics);
  const safe = looksLikeHtml(html)
    ? sanitizeWordingHtml(html)
    : sanitizeWordingHtml(plainTextToWordingHtml(html));

  const baseStyle: RichTextRunStyle = {
    bold: Boolean(base.bold),
    italic: Boolean(base.italic),
    underline: Boolean(base.underline),
    fontSizePt: base.fontSizePt,
    family: base.family,
  };

  type Block = {
    runs: TextRun[];
    indentPx: number;
    marker?: string;
    /** Groups items in the same <ol>/<ul> for shared marker-column width. */
    listGroupId?: number;
  };

  const blocks: Block[] = [];
  let currentRuns: TextRun[] = [];
  const styleStack: RichTextRunStyle[] = [cloneStyle(baseStyle)];
  let indentPx = 0;
  type ListFrame = {
    tag: "ul" | "ol";
    style: WordingListStyle;
    index: number;
    groupId: number;
  };
  const listStack: ListFrame[] = [];
  let pendingMarker: string | undefined;
  let pendingListGroupId: number | undefined;
  let nextListGroupId = 1;
  /** Match TipTap indent step (~24 CSS px per list level). */
  const LIST_INDENT_PX = 24;

  const style = () => styleStack[styleStack.length - 1]!;
  const listItemIndentPx = () =>
    listStack.length > 0 ? listStack.length * LIST_INDENT_PX : 0;
  const markerMeasureStyle: RichTextRunStyle = {
    ...baseStyle,
    bold: false,
    italic: false,
    underline: false,
  };

  const pushText = (text: string) => {
    if (!text) return;
    const s = style();
    const last = currentRuns[currentRuns.length - 1];
    if (
      last &&
      last.style.bold === s.bold &&
      last.style.italic === s.italic &&
      last.style.underline === s.underline &&
      last.style.fontSizePt === s.fontSizePt &&
      last.style.family === s.family
    ) {
      last.text += text;
    } else {
      currentRuns.push({ text, style: cloneStyle(s) });
    }
  };

  const flushBlock = (marker?: string, opts?: { allowEmpty?: boolean }) => {
    const hasText = currentRuns.some((r) => r.text.trim());
    const resolvedMarker = marker ?? pendingMarker;
    if (!hasText && !resolvedMarker) {
      currentRuns = [];
      // Empty <p></p> / <br> → keep a blank line (Display Home spacing).
      if (opts?.allowEmpty) {
        blocks.push({ runs: [], indentPx, marker: undefined });
      }
      return;
    }
    blocks.push({
      runs: currentRuns,
      indentPx,
      marker: resolvedMarker,
      listGroupId: resolvedMarker ? pendingListGroupId : undefined,
    });
    currentRuns = [];
    pendingMarker = undefined;
    pendingListGroupId = undefined;
  };

  const tokenRe = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(safe)) !== null) {
    if (match[3] != null) {
      // Soft newlines in text nodes are not visual breaks — block tags handle those.
      pushText(decodeEntities(match[3]).replace(/\s*\n\s*/g, " "));
      continue;
    }
    const tag = (match[1] ?? "").toLowerCase();
    const isClose = match[0].startsWith("</");
    const attrs = match[2] ?? "";

    if (tag === "br") {
      const hasText = currentRuns.some((r) => r.text.trim());
      if (hasText) flushBlock();
      else flushBlock(undefined, { allowEmpty: true });
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      if (!isClose) {
        flushBlock();
        const rawStyle = readAttr(attrs, "data-list-style");
        const nextStyle =
          rawStyle && isWordingListStyle(rawStyle)
            ? rawStyle
            : defaultListStyleForTag(tag);
        listStack.push({
          tag,
          style: nextStyle,
          index: 0,
          groupId: nextListGroupId++,
        });
        indentPx = listItemIndentPx();
      } else {
        flushBlock();
        listStack.pop();
        indentPx = listItemIndentPx();
      }
      continue;
    }

    if (tag === "li") {
      if (!isClose) {
        flushBlock();
        const frame = listStack[listStack.length - 1];
        const dataIndent = readAttr(attrs, "data-indent");
        const styleAttr = readAttr(attrs, "style") ?? "";
        const decls = parseStyleDecls(styleAttr);
        if (dataIndent) indentPx = Number(dataIndent) * LIST_INDENT_PX;
        else if (decls["margin-left"]) {
          indentPx = Number.parseFloat(decls["margin-left"]) || 0;
        } else {
          indentPx = listItemIndentPx();
        }
        if (frame) {
          frame.index += 1;
          pendingMarker = formatWordingListMarker(frame.style, frame.index);
          pendingListGroupId = frame.groupId;
        } else {
          pendingMarker = "- ";
          pendingListGroupId = undefined;
        }
      } else {
        flushBlock();
        indentPx = listItemIndentPx();
      }
      continue;
    }

    if (tag === "p" || tag === "div") {
      if (!isClose) {
        // TipTap uses <li><p>…</p></li>. Do not flush an empty block here or
        // the list marker is consumed before the paragraph text arrives.
        const hasText = currentRuns.some((r) => r.text.trim());
        if (hasText) flushBlock();
        const dataIndent = readAttr(attrs, "data-indent");
        const styleAttr = readAttr(attrs, "style") ?? "";
        const decls = parseStyleDecls(styleAttr);
        if (dataIndent) indentPx = Number(dataIndent) * LIST_INDENT_PX;
        else if (decls["margin-left"]) {
          indentPx = Number.parseFloat(decls["margin-left"]) || 0;
        } else if (listStack.length > 0) {
          indentPx = listItemIndentPx();
        } else {
          indentPx = 0;
        }
      } else {
        const hasText = currentRuns.some((r) => r.text.trim());
        if (hasText || pendingMarker) flushBlock();
        else flushBlock(undefined, { allowEmpty: true });
        // Stay indented while still inside a list item.
        indentPx = listItemIndentPx();
      }
      continue;
    }

    if (isClose) {
      if (
        tag === "strong" ||
        tag === "b" ||
        tag === "em" ||
        tag === "i" ||
        tag === "u" ||
        tag === "span"
      ) {
        if (styleStack.length > 1) styleStack.pop();
      }
      continue;
    }

    if (tag === "strong" || tag === "b") {
      const next = cloneStyle(style());
      next.bold = true;
      styleStack.push(next);
      continue;
    }
    if (tag === "em" || tag === "i") {
      const next = cloneStyle(style());
      next.italic = true;
      styleStack.push(next);
      continue;
    }
    if (tag === "u") {
      const next = cloneStyle(style());
      next.underline = true;
      styleStack.push(next);
      continue;
    }
    if (tag === "span") {
      const next = cloneStyle(style());
      const decls = parseStyleDecls(readAttr(attrs, "style") ?? "");
      if (decls["font-weight"] && /bold|700/i.test(decls["font-weight"])) {
        next.bold = true;
      }
      if (decls["font-style"] && /italic/i.test(decls["font-style"])) {
        next.italic = true;
      }
      if (
        decls["text-decoration"] &&
        /underline/i.test(decls["text-decoration"])
      ) {
        next.underline = true;
      }
      // Match surrounding PDF fields: ignore TipTap size/family overrides.
      if (!lockSchemaMetrics) {
        if (decls["font-size"]) {
          const m = /(\d+(?:\.\d+)?)/.exec(decls["font-size"]);
          if (m) next.fontSizePt = Number(m[1]);
        }
        if (decls["font-family"]) {
          const family = normalizeFontFamily(decls["font-family"]);
          if (family) next.family = family;
        }
      } else {
        next.fontSizePt = baseStyle.fontSizePt;
        next.family = baseStyle.family;
      }
      styleStack.push(next);
    }
  }
  flushBlock();

  // Per-list marker column = widest marker in that list ("(iii) " / "a) " slot).
  const markerSlotByGroup = new Map<number, number>();
  for (const block of blocks) {
    if (!block.marker || block.listGroupId == null) continue;
    const w = measure(block.marker, markerMeasureStyle);
    const prev = markerSlotByGroup.get(block.listGroupId) ?? 0;
    if (w > prev) markerSlotByGroup.set(block.listGroupId, w);
  }

  // Word-wrap blocks into lines within widthMm.
  const widthPt = widthMm * MM_TO_PT;
  const lines: DrawLine[] = [];

  for (const block of blocks) {
    const hasText = block.runs.some((r) => r.text.trim());
    if (!hasText && !block.marker) {
      // Blank paragraph / <br> — advance one line in the PDF.
      lines.push({ runs: [], indentPx: block.indentPx });
      continue;
    }

    const indentPt = (block.indentPx / 96) * 72; // CSS px ≈ 96dpi → pt
    const ownMarkerWidth = block.marker
      ? measure(block.marker, markerMeasureStyle)
      : 0;
    const markerSlotPt =
      block.listGroupId != null
        ? (markerSlotByGroup.get(block.listGroupId) ?? ownMarkerWidth)
        : ownMarkerWidth;
    const maxWidth = Math.max(20, widthPt - indentPt - markerSlotPt);

    type Piece = { text: string; style: RichTextRunStyle };
    const pieces: Piece[] = [];
    for (const run of block.runs) {
      const parts = run.text.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        // Don't start a wrapped line with leading spaces — hanging indent
        // already positions the body column (important for a) / (i) wraps).
        if (pieces.length === 0 && /^\s+$/.test(part)) {
          continue;
        }
        pieces.push({ text: part, style: run.style });
      }
    }

    let lineRuns: TextRun[] = [];
    let lineWidth = 0;
    let isFirstLine = true;

    const pushLine = () => {
      if (lineRuns.length === 0 && !block.marker) return;
      // Drop leading whitespace on wrap lines so text sits on the hang column.
      if (!isFirstLine) {
        while (lineRuns.length > 0 && !lineRuns[0]!.text.trim()) {
          lineRuns.shift();
        }
        if (lineRuns.length === 0) {
          lineWidth = 0;
          return;
        }
      }
      lines.push({
        runs: lineRuns,
        indentPx: block.indentPx,
        marker: isFirstLine ? block.marker : undefined,
        // Keep group on every line (incl. wraps) so draw can hang-indent.
        listGroupId: block.listGroupId,
      });
      lineRuns = [];
      lineWidth = 0;
      isFirstLine = false;
    };

    for (const piece of pieces) {
      const w = measure(piece.text, piece.style);
      if (lineWidth + w > maxWidth && lineRuns.length > 0) {
        pushLine();
      }
      // Hard-break very long tokens.
      if (w > maxWidth && piece.text.trim()) {
        let remaining = piece.text;
        while (remaining) {
          let fit = remaining.length;
          while (
            fit > 1 &&
            measure(remaining.slice(0, fit), piece.style) > maxWidth
          ) {
            fit -= 1;
          }
          lineRuns.push({ text: remaining.slice(0, fit), style: piece.style });
          pushLine();
          remaining = remaining.slice(fit);
        }
        continue;
      }
      const last = lineRuns[lineRuns.length - 1];
      if (
        last &&
        last.style.bold === piece.style.bold &&
        last.style.italic === piece.style.italic &&
        last.style.underline === piece.style.underline &&
        last.style.fontSizePt === piece.style.fontSizePt &&
        last.style.family === piece.style.family
      ) {
        last.text += piece.text;
      } else {
        lineRuns.push({ text: piece.text, style: piece.style });
      }
      lineWidth += w;
    }
    pushLine();
  }

  // Drop TipTap / empty-<p> trailing blanks so list endings don't add a
  // phantom line (or force a near-empty continuation page).
  while (
    lines.length > 0 &&
    !lines[lines.length - 1]!.marker &&
    !lines[lines.length - 1]!.runs.some((r) => r.text.trim())
  ) {
    lines.pop();
  }

  return lines.length > 0 ? lines : [{ runs: [], indentPx: 0 }];
}

export function lineHasInk(line: DrawLine): boolean {
  return Boolean(line.marker) || line.runs.some((r) => r.text.trim());
}

export function wordingHtmlLineCount(
  html: string,
  widthMm: number,
  fontSizePt: number,
): number {
  const lines = htmlToDrawLines(
    html,
    { fontSizePt, family: "Roboto" },
    widthMm,
    (text, style) => heuristicTextWidthPt(text, style.fontSizePt || fontSizePt),
    { lockSchemaMetrics: true },
  );
  if (lines.length === 1 && !lineHasInk(lines[0]!)) return 0;
  return lines.length;
}

export function estimateWordingHtmlHeightMm(
  html: string,
  widthMm: number,
  fontSizePt: number,
  lineHeight: number,
): number {
  const count = wordingHtmlLineCount(html, widthMm, fontSizePt);
  return endorsementReserveHeightForLinesMm(count, fontSizePt, lineHeight);
}

/**
 * Split a line count across pages by how many lines actually fit in each band.
 * Never opens a page for a fractional leftover millimetre.
 */

// Re-export geometry functions for backward compatibility
// Re-export geometry functions for backward compatibility
export {
  countLinesFittingInBandMm,
  endorsementDrawBoxBottomMm,
  endorsementLineStepMm,
  endorsementPaintHeightForLinesMm,
  endorsementPaintTopInsetMm,
  endorsementReserveHeightForLinesMm,
  minEndorsementPaintBandMm,
  splitHeightIntoPageChunks,
  splitLineCountsIntoPages,
} from "~/lib/pdf/html-rich-text-geometry";
