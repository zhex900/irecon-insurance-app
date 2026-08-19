import { inflateSync, unzipSync } from "node:zlib";

import type { Schema, Template } from "@pdfme/common";

import {
  type DocumentPageOrientation,
  withBlankPageBackground,
} from "~/lib/pdf/templates";

const PT_TO_MM = 25.4 / 72;

type RgbColor = { r: number; g: number; b: number };

type PdfRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: RgbColor;
};

type ExtractedBlock = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  colorHex: string;
};

function stripDataUri(basePdf: string): Buffer {
  const raw = basePdf.replace(/^data:application\/pdf;base64,/i, "");
  return Buffer.from(raw, "base64");
}

function toHex(color: RgbColor): string {
  const channel = (n: number) =>
    Math.round(Math.min(1, Math.max(0, n)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function parsePageSizes(
  pdfBytes: Buffer,
): Array<{ width: number; height: number }> {
  const text = pdfBytes.toString("latin1");
  const sizes: Array<{ width: number; height: number }> = [];
  const re =
    /\/MediaBox\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const width = Number(match[3]) - Number(match[1]);
    const height = Number(match[4]) - Number(match[2]);
    if (width > 0 && height > 0) sizes.push({ width, height });
  }
  return sizes.length > 0
    ? sizes
    : [{ width: 595.275590551181, height: 841.889763779528 }];
}

function inflateStream(dict: string, body: Buffer): Buffer | null {
  if (!/FlateDecode/.test(dict)) return body;
  try {
    return inflateSync(body);
  } catch {
    try {
      return unzipSync(body);
    } catch {
      return null;
    }
  }
}

/** Parse coloured `re` fills from one content stream (PDF points, bottom-left origin). */
function parseColoredRects(content: string): PdfRect[] {
  const rects: PdfRect[] = [];
  let fillColor: RgbColor | null = null;
  const tokenRe =
    /([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+rg|([0-9.-]+)\s+g|([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+([0-9.-]+)\s+re/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(content))) {
    if (match[1] != null) {
      fillColor = { r: +match[1], g: +match[2], b: +match[3] };
      continue;
    }
    if (match[4] != null) {
      const gray = +match[4];
      fillColor = { r: gray, g: gray, b: gray };
      continue;
    }
    if (match[5] == null || !fillColor) continue;
    rects.push({
      x: +match[5],
      y: +match[6],
      w: +match[7],
      h: +match[8],
      color: fillColor,
    });
  }
  return rects;
}

function isUsefulRect(
  rect: PdfRect,
  pageWidth: number,
  pageHeight: number,
): boolean {
  const width = Math.abs(rect.w);
  const height = Math.abs(rect.h);
  if (width < 2 || height < 2) return false;
  if (width * height > pageWidth * pageHeight * 0.85) return false;

  const { r, g, b } = rect.color;
  const hex = toHex(rect.color);
  // Word export artifacts (clip / text masks), not design blocks.
  if (hex === "#000000" || hex === "#ff0000") return false;
  if (r > 0.98 && g > 0.98 && b > 0.98) return false;
  return true;
}

/** Merge horizontally contiguous same-colour cells into single editable bands. */
function mergeHorizontalRects(rects: PdfRect[]): PdfRect[] {
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 0.5) return b.y - a.y;
    return a.x - b.x;
  });
  const merged: PdfRect[] = [];
  for (const rect of sorted) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      toHex(prev.color) === toHex(rect.color) &&
      Math.abs(prev.y - rect.y) < 0.5 &&
      Math.abs(prev.h - rect.h) < 0.5 &&
      Math.abs(prev.x + prev.w - rect.x) < 1.5
    ) {
      prev.w = rect.x + rect.w - prev.x;
      continue;
    }
    merged.push({ ...rect, color: { ...rect.color } });
  }
  return merged;
}

function toPdfmeBlock(rect: PdfRect, pageHeight: number): ExtractedBlock {
  const x = Math.min(rect.x, rect.x + rect.w);
  const y = Math.min(rect.y, rect.y + rect.h);
  const width = Math.abs(rect.w);
  const height = Math.abs(rect.h);
  return {
    xMm: roundMm(x * PT_TO_MM),
    yMm: roundMm((pageHeight - y - height) * PT_TO_MM),
    widthMm: roundMm(width * PT_TO_MM),
    heightMm: roundMm(height * PT_TO_MM),
    colorHex: toHex(rect.color),
  };
}

function roundMm(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Extract coloured filled rectangles from a static base PDF, per page.
 * Used to turn Word/PDF chrome bands into editable pdfme rectangle schemas.
 */
function extractColoredBlocksFromBasePdf(basePdf: string): ExtractedBlock[][] {
  const pdfBytes = stripDataUri(basePdf);
  const pageSizes = parsePageSizes(pdfBytes);
  const text = pdfBytes.toString("latin1");
  const streamRe = /<<([^>]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;

  const pages: ExtractedBlock[][] = [];
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(text))) {
    const inflated = inflateStream(match[1], Buffer.from(match[2], "latin1"));
    if (!inflated) continue;
    const content = inflated.toString("latin1");
    if (!/\bre\b/.test(content)) continue;

    const pageIndex = pages.length;
    const size = pageSizes[Math.min(pageIndex, pageSizes.length - 1)]!;
    const useful = parseColoredRects(content).filter((rect) =>
      isUsefulRect(rect, size.width, size.height),
    );
    const merged = mergeHorizontalRects(useful);
    pages.push(merged.map((rect) => toPdfmeBlock(rect, size.height)));
  }

  return pages;
}

function hasExtractedBlocks(template: Template): boolean {
  return template.schemas.some((page) =>
    page.some(
      (schema) =>
        schema.type === "rectangle" &&
        typeof schema.name === "string" &&
        schema.name.startsWith("_Block_"),
    ),
  );
}

function blockToSchema(
  block: ExtractedBlock,
  pageIndex: number,
  blockIndex: number,
): Schema {
  return {
    name: `_Block_${pageIndex + 1}_${blockIndex + 1}`,
    type: "rectangle",
    position: { x: block.xMm, y: block.yMm },
    width: block.widthMm,
    height: block.heightMm,
    rotate: 0,
    opacity: 1,
    borderWidth: 0,
    borderColor: "#000000",
    color: block.colorHex,
    readOnly: true,
    radius: 0,
  };
}

/**
 * Replace a static base PDF with a blank canvas and promote coloured fills
 * into editable rectangle schemas (drawn behind existing fields).
 */
export function promoteStaticBackgroundToEditableSchemas(
  template: Template,
): Template {
  if (typeof template.basePdf !== "string") {
    return withBlankPageBackground(template);
  }

  if (hasExtractedBlocks(template)) {
    return withBlankPageBackground(template);
  }

  const pdfBytes = stripDataUri(template.basePdf);
  const pageSizes = parsePageSizes(pdfBytes);
  const firstPage = pageSizes[0];
  const orientation: DocumentPageOrientation =
    firstPage && firstPage.width > firstPage.height ? "landscape" : "portrait";

  const blocksByPage = extractColoredBlocksFromBasePdf(template.basePdf);
  const pageCount = Math.max(template.schemas.length, blocksByPage.length, 1);

  const schemas: Schema[][] = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const existing = template.schemas[pageIndex] ?? [];
    const blocks = blocksByPage[pageIndex] ?? [];
    const rectSchemas = blocks.map((block, blockIndex) =>
      blockToSchema(block, pageIndex, blockIndex),
    );
    schemas.push([...rectSchemas, ...existing]);
  }

  return withBlankPageBackground(
    {
      ...template,
      schemas,
    },
    orientation,
  );
}
