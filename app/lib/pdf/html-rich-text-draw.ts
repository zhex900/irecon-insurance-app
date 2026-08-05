/**
 * Draw Additional Wording HTML onto a pdfme-generated PDF with pdf-lib.
 * pdfme text schemas cannot render underline / per-span font / lists.
 */
import type { Font } from "@pdfme/common";
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
  rgb,
} from "pdf-lib";
import {
  parsePdfmeFontName,
  resolvePdfmeFontName,
  type PdfmeFontFamily,
  type PdfmeFontStyle,
  type PdfmeFontWeight,
} from "~/lib/pdf/font-config";
import { ENDORSEMENT_PAGE_BOTTOM_MARGIN_MM } from "~/lib/pdf/endorsement-expand";
import {
  countLinesFittingInBandMm,
  endorsementDrawBoxBottomMm,
  heuristicTextWidthPt,
  htmlToDrawLines,
  lineHasInk,
  type DrawLine,
} from "~/lib/pdf/html-rich-text-lines";

export {
  htmlToDrawLines,
  type DrawLine,
  type HtmlToDrawLinesOptions,
} from "~/lib/pdf/html-rich-text-lines";

const MM_TO_PT = 72 / 25.4;

export type EndorsementRichDrawOp = {
  pageIndex: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  html: string;
  fontSizePt: number;
  fontName: string;
  fontColor: string;
  lineHeight: number;
  /** Top of content area on overflow pages (mm from page top). */
  continuationTopMm?: number;
  /** Fallback max body height on overflow pages (mm). */
  continuationHeightMm?: number;
  /** Reserved body height (mm) per overflow page, in order. */
  continuationHeightsMm?: number[];
  /**
   * Exact line counts per page band: [first, ...continuations].
   * When set, draw never paints more lines on a band than layout planned —
   * leftover lines open a private page (shifting later drawOps) instead of
   * overprinting the next endorsement at the page top.
   */
  pageLineBudgets?: number[];
  /** Must match expand's page bottom margin or lines orphan / empty pages appear. */
  pageBottomMarginMm?: number;
};

function parseHexColor(color: string): { r: number; g: number; b: number } {
  const raw = (color || "#111111").trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(raw);
  if (!m) return { r: 0.07, g: 0.07, b: 0.07 };
  const n = Number.parseInt(m[1]!, 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  };
}

function fontKey(
  family: PdfmeFontFamily,
  bold: boolean,
  italic: boolean,
): string {
  const weight: PdfmeFontWeight = bold ? "700" : "400";
  const style: PdfmeFontStyle = italic ? "italic" : "normal";
  return resolvePdfmeFontName(family, weight, style);
}

async function embedFontMap(
  doc: PDFDocument,
  fontCatalog: Font,
): Promise<Map<string, PDFFont>> {
  const map = new Map<string, PDFFont>();
  const families: PdfmeFontFamily[] = ["Roboto", "Times New Roman"];
  for (const family of families) {
    for (const bold of [false, true]) {
      for (const italic of [false, true]) {
        const key = fontKey(family, bold, italic);
        const entry = fontCatalog[key] ?? fontCatalog[family];
        if (!entry?.data) continue;
        const raw = entry.data;
        let bytes: Uint8Array | null = null;
        if (raw instanceof Uint8Array) bytes = raw;
        else if (raw instanceof ArrayBuffer) bytes = new Uint8Array(raw);
        else if (typeof raw === "string") {
          // pdfme may store base64
          const binary = atob(raw);
          bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
        }
        if (!bytes) continue;
        try {
          map.set(key, await doc.embedFont(bytes, { subset: true }));
        } catch {
          try {
            map.set(key, await doc.embedFont(bytes, { subset: false }));
          } catch {
            // skip broken face
          }
        }
      }
    }
  }
  return map;
}

/** Strip / replace glyphs that commonly break pdf-lib drawText. */
function sanitizeDrawText(text: string): string {
  return (
    text
      .replace(/\u2022/g, "-")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u00A0/g, " ")
      // Keep printable Latin + Latin Extended-A/B; drop other controls/glyphs.
      .replace(/[^\u0020-\u007E\u00A0-\u024F]/g, "")
  );
}

function safeDrawText(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color: ReturnType<typeof rgb>;
  },
): number {
  const cleaned = sanitizeDrawText(text);
  if (!cleaned) return 0;
  try {
    page.drawText(cleaned, opts);
    return opts.font.widthOfTextAtSize(cleaned, opts.size);
  } catch {
    // Last resort: ASCII-only
    const ascii = cleaned.replace(/[^\x20-\x7E]/g, "");
    if (!ascii) return 0;
    try {
      page.drawText(ascii, opts);
      return opts.font.widthOfTextAtSize(ascii, opts.size);
    } catch {
      return 0;
    }
  }
}

function ensurePageAt(
  doc: PDFDocument,
  pageIndex: number,
  width: number,
  height: number,
): PDFPage {
  while (doc.getPageCount() <= pageIndex) {
    doc.addPage([width, height]);
  }
  return doc.getPages()[pageIndex]!;
}

/**
 * Paint wrapped lines starting at `op`, flowing onto following pages when the
 * block is taller than the remaining space (long HTML endorsements).
 *
 * `onPageInserted` runs when a blank page is spliced in because layout did not
 * reserve enough continuation pages — later drawOps must shift their pageIndex.
 */
/** Returns the last page index that received painted ink. */
function drawLinesAcrossPages(
  doc: PDFDocument,
  lines: DrawLine[],
  op: EndorsementRichDrawOp,
  fonts: Map<string, PDFFont>,
  fallback: PDFFont,
  onPageInserted?: (pageIndex: number) => void,
): number {
  const startPage = ensurePageAt(
    doc,
    op.pageIndex,
    doc.getPages()[0]?.getWidth() ?? 595.28,
    doc.getPages()[0]?.getHeight() ?? 841.89,
  );
  const pageWidth = startPage.getWidth();
  const pageHeight = startPage.getHeight();
  const x0 = op.xMm * MM_TO_PT;
  const color = parseHexColor(op.fontColor);
  const colorRgb = rgb(color.r, color.g, color.b);
  const pageHeightMm = pageHeight / MM_TO_PT;
  const pageBottomMarginMm =
    Number.isFinite(op.pageBottomMarginMm) && (op.pageBottomMarginMm ?? 0) >= 0
      ? Number(op.pageBottomMarginMm)
      : ENDORSEMENT_PAGE_BOTTOM_MARGIN_MM;
  // Overflow pages start at the template content top (not the first-box yMm).
  const continuationTopMm =
    Number.isFinite(op.continuationTopMm) && (op.continuationTopMm ?? 0) >= 0
      ? Number(op.continuationTopMm)
      : 10;
  const continuationHeightFallbackMm =
    Number.isFinite(op.continuationHeightMm) &&
    (op.continuationHeightMm ?? 0) > 0
      ? Number(op.continuationHeightMm)
      : Math.max(40, pageHeightMm - continuationTopMm - pageBottomMarginMm);
  const continuationHeightsMm = Array.isArray(op.continuationHeightsMm)
    ? op.continuationHeightsMm.filter(
        (h) => Number.isFinite(h) && Number(h) > 0,
      )
    : [];
  const pageLineBudgets = Array.isArray(op.pageLineBudgets)
    ? op.pageLineBudgets
        .filter((n) => Number.isFinite(n) && Number(n) >= 0)
        .map((n) => Math.floor(Number(n)))
    : [];

  const parsedOpFont = parsePdfmeFontName(op.fontName);
  const lineHeight =
    Number.isFinite(op.lineHeight) && op.lineHeight > 0 ? op.lineHeight : 1.25;
  // Match pdfme text: advance = fontSize × lineHeight (no extra shrink factor).
  const step = op.fontSizePt * lineHeight;
  // pdfme top-aligns; first baseline sits roughly one em below the box top.
  const baselineFromTop = op.fontSizePt * 0.85;

  // Schema weight is the baseline (e.g. Subject = Roboto Bold). HTML <strong>
  // can add bold on Regular body text, but must not "double-bold" a Bold schema.
  const schemaBold = parsedOpFont.weight === "700";
  const schemaItalic = parsedOpFont.style === "italic";
  const markerFont =
    fonts.get(fontKey(parsedOpFont.family, schemaBold, schemaItalic)) ??
    fallback;

  // Draw-time marker column (actual font metrics) — keeps a) / (i) wraps aligned
  // with the first-line body, not under the marker.
  const markerSlotByGroup = new Map<number, number>();
  for (const line of lines) {
    if (!line.marker || line.listGroupId == null) continue;
    const w = markerFont.widthOfTextAtSize(
      sanitizeDrawText(line.marker),
      op.fontSizePt,
    );
    const prev = markerSlotByGroup.get(line.listGroupId) ?? 0;
    if (w > prev) markerSlotByGroup.set(line.listGroupId, w);
  }

  /** -1 = first page; 0+ = overflow page index into continuationHeightsMm. */
  let overflowIndex = -1;
  let linesOnPage = 0;

  function reservedHeightMm(): number {
    if (overflowIndex < 0) {
      return Math.max(op.heightMm, step / MM_TO_PT);
    }
    if (overflowIndex < continuationHeightsMm.length) {
      return Number(continuationHeightsMm[overflowIndex]);
    }
    return continuationHeightFallbackMm;
  }

  function lineBudgetForPage(): number | null {
    if (pageLineBudgets.length === 0) return null;
    if (overflowIndex < 0) return pageLineBudgets[0] ?? null;
    const idx = overflowIndex + 1;
    if (idx < pageLineBudgets.length) return pageLineBudgets[idx]!;
    // Unplanned overflow page — pack to the fallback band.
    return Math.max(
      1,
      countLinesFittingInBandMm(
        continuationHeightFallbackMm,
        op.fontSizePt,
        lineHeight,
      ),
    );
  }

  function minCursorYForPage(): number {
    const pageFloorMm = pageHeightMm - pageBottomMarginMm;
    const reservedBottomMm =
      overflowIndex < 0
        ? op.yMm + reservedHeightMm()
        : continuationTopMm + reservedHeightMm();
    const boxBottomMm = endorsementDrawBoxBottomMm({
      pageFloorMm,
      reservedBottomMm,
      lineStepMm: step / MM_TO_PT,
    });
    return pageHeight - boxBottomMm * MM_TO_PT;
  }

  function claimOverflowPage(nextPageIndex: number, nextOverflowIndex: number) {
    // Past layout-reserved pages: always take a private page and shift later
    // drawOps. Previously we only inserted when nextPageIndex < pageCount, so
    // a spill that appended a page still shared that index with Heritage etc.
    const pastLayoutReservation =
      nextOverflowIndex >= continuationHeightsMm.length;
    if (pastLayoutReservation) {
      if (nextPageIndex < doc.getPageCount()) {
        doc.insertPage(nextPageIndex, [pageWidth, pageHeight]);
      } else {
        doc.addPage([pageWidth, pageHeight]);
      }
      onPageInserted?.(nextPageIndex);
    }
  }

  let pageIndex = op.pageIndex;
  let page = startPage;
  let cursorY = pageHeight - op.yMm * MM_TO_PT - baselineFromTop;

  for (let i = 0; i < lines.length; i++) {
    const budget = lineBudgetForPage();
    const overBudget = budget != null && linesOnPage >= budget;
    // When layout provided a line budget, trust it over mm height — reserved
    // height is often toFixed(2)'d and can be 0.01mm short of the last baseline,
    // which used to spill one line onto the next page top (overlap).
    // Without a budget, break when the baseline would sit below the floor.
    const outOfBand =
      budget != null ? overBudget : cursorY < minCursorYForPage();
    if (outOfBand) {
      // Don't open a page that would only hold blank trailing lines.
      if (!lines.slice(i).some(lineHasInk)) break;
      const nextPageIndex = pageIndex + 1;
      const nextOverflowIndex = overflowIndex + 1;
      claimOverflowPage(nextPageIndex, nextOverflowIndex);
      pageIndex = nextPageIndex;
      page = ensurePageAt(doc, pageIndex, pageWidth, pageHeight);
      overflowIndex = nextOverflowIndex;
      linesOnPage = 0;
      cursorY = pageHeight - continuationTopMm * MM_TO_PT - baselineFromTop;
      while (i < lines.length && !lineHasInk(lines[i]!)) i += 1;
      if (i >= lines.length) break;
      const nextBudget = lineBudgetForPage();
      // Reserved band / budget shorter than one line — stop rather than paint
      // over the next endorsement subject packed below on this page.
      if (nextBudget != null) {
        if (nextBudget < 1) break;
      } else if (cursorY < minCursorYForPage()) {
        break;
      }
    }

    const line = lines[i]!;
    const indentPt = (line.indentPx / 96) * 72;
    let x = x0 + indentPt;
    const slot =
      line.listGroupId != null
        ? (markerSlotByGroup.get(line.listGroupId) ?? 0)
        : 0;
    if (line.marker) {
      const markerW = markerFont.widthOfTextAtSize(
        sanitizeDrawText(line.marker),
        op.fontSizePt,
      );
      const col = Math.max(slot, markerW);
      // Right-align "a)" / "(i)" with the longest marker in this list.
      safeDrawText(page, line.marker, {
        x: x + (col - markerW),
        y: cursorY,
        size: op.fontSizePt,
        font: markerFont,
        color: colorRgb,
      });
      x += col;
    } else if (slot > 0) {
      // Wrapped list body — same x as text after the marker on line 1.
      x += slot;
    }
    for (const run of line.runs) {
      if (!run.text) continue;
      const bold = schemaBold || Boolean(run.style.bold);
      const italic = schemaItalic || Boolean(run.style.italic);
      const key = fontKey(parsedOpFont.family, bold, italic);
      const font = fonts.get(key) ?? fallback;
      const size = op.fontSizePt;
      const w = safeDrawText(page, run.text, {
        x,
        y: cursorY,
        size,
        font,
        color: colorRgb,
      });
      if (run.style.underline && w > 0) {
        page.drawLine({
          start: { x, y: cursorY - 1.2 },
          end: { x: x + w, y: cursorY - 1.2 },
          thickness: Math.max(0.5, size * 0.05),
          color: colorRgb,
        });
      }
      x += w;
    }
    cursorY -= step;
    linesOnPage += 1;
  }
  return pageIndex;
}

export async function applyEndorsementRichDrawOps(
  pdfBytes: Uint8Array,
  ops: EndorsementRichDrawOp[],
  fontCatalog: Font,
): Promise<Uint8Array> {
  if (ops.length === 0) return pdfBytes;

  const doc = await PDFDocument.load(pdfBytes);
  const fonts = await embedFontMap(doc, fontCatalog);
  let fallback = fonts.get("Roboto") ?? fonts.values().next().value;
  if (!fallback) {
    // Never skip HTML endorsements because custom faces failed to embed.
    fallback = await doc.embedFont(StandardFonts.Helvetica);
    fonts.set("Roboto", fallback);
  }
  if (!fonts.has("Roboto Bold")) {
    fonts.set("Roboto Bold", await doc.embedFont(StandardFonts.HelveticaBold));
  }
  if (!fonts.has("Roboto Italic")) {
    fonts.set(
      "Roboto Italic",
      await doc.embedFont(StandardFonts.HelveticaOblique),
    );
  }
  if (!fonts.has("Roboto Bold Italic")) {
    fonts.set(
      "Roboto Bold Italic",
      await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    );
  }
  if (!fonts.has("Times New Roman")) {
    fonts.set("Times New Roman", await doc.embedFont(StandardFonts.TimesRoman));
  }
  if (!fonts.has("Times New Roman Bold")) {
    fonts.set(
      "Times New Roman Bold",
      await doc.embedFont(StandardFonts.TimesRomanBold),
    );
  }
  if (!fonts.has("Times New Roman Italic")) {
    fonts.set(
      "Times New Roman Italic",
      await doc.embedFont(StandardFonts.TimesRomanItalic),
    );
  }
  if (!fonts.has("Times New Roman Bold Italic")) {
    fonts.set(
      "Times New Roman Bold Italic",
      await doc.embedFont(StandardFonts.TimesRomanBoldItalic),
    );
  }

  let lastPaintedPage = -1;
  for (let opIndex = 0; opIndex < ops.length; opIndex++) {
    const op = ops[opIndex]!;
    if (!op.html.trim()) continue;
    if (op.pageIndex < 0) continue;

    try {
      const parsed = parsePdfmeFontName(op.fontName);
      // Wrap with the same heuristic as endorsement-expand so reserved page
      // heights match drawn line counts (avoids large gaps before the next
      // wording, e.g. Heritage after Display Home).
      const lines = htmlToDrawLines(
        op.html,
        {
          fontSizePt: op.fontSizePt,
          family: parsed.family,
          bold: parsed.weight === "700",
          italic: parsed.style === "italic",
        },
        op.widthMm,
        // Match endorsement-expand / wordingHtmlLineCount — do not sanitize
        // before measure or wrap counts drift and spill onto the next page.
        (text, style) =>
          heuristicTextWidthPt(text, style.fontSizePt || op.fontSizePt),
        { lockSchemaMetrics: true },
      );
      const endPage = drawLinesAcrossPages(
        doc,
        lines,
        op,
        fonts,
        fallback!,
        (insertedAt) => {
          for (let j = opIndex + 1; j < ops.length; j++) {
            const later = ops[j]!;
            if (later.pageIndex >= insertedAt) later.pageIndex += 1;
          }
        },
      );
      lastPaintedPage = Math.max(lastPaintedPage, endPage);
    } catch {
      // Skip this op; pdfme plain-text fallback remains visible.
    }
  }

  // Drop trailing blank continuation pages left by pdfme when draw packed the
  // last line onto the previous page — never drop a page still targeted by ops.
  let maxNeededPage = lastPaintedPage;
  for (const op of ops) {
    if (op.pageIndex > maxNeededPage) maxNeededPage = op.pageIndex;
  }
  if (maxNeededPage >= 0) {
    while (doc.getPageCount() > maxNeededPage + 1) {
      doc.removePage(doc.getPageCount() - 1);
    }
  }

  return doc.save();
}
