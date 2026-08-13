/**
 * Word-wrapping logic for HTML rich text rendering.
 * Extracted from html-rich-text-lines.ts to reduce file size.
 */

import type { PdfmeFontFamily } from "~/lib/pdf/font-config";
import type { DrawLine, TextRun, RichTextRunStyle } from "./html-rich-text-parser";

const MM_TO_PT = 72 / 25.4;

export type WrapBlock = {
  runs: TextRun[];
  indentPx: number;
  marker?: string;
  listGroupId?: number;
};

export type WrapOptions = {
  widthMm: number;
  measure: (text: string, style: RichTextRunStyle) => number;
  markerMeasureStyle: RichTextRunStyle;
  markerSlotByGroup?: Map<number, number>;
};

/**
 * Word-wrap a block of text into lines within the specified width.
 * Handles hanging indents for list markers and proper whitespace handling.
 */
export function wrapBlockToLines(
  block: WrapBlock,
  options: WrapOptions
): DrawLine[] {
  const { widthMm, measure, markerMeasureStyle } = options;
  const widthPt = widthMm * MM_TO_PT;

  const lines: DrawLine[] = [];

  // Check if block has content
  const hasText = block.runs.some((r) => r.text.trim());
  if (!hasText && !block.marker) {
    // Blank paragraph / <br> — advance one line in the PDF.
    lines.push({ runs: [], indentPx: block.indentPx });
    return lines;
  }

  // Calculate indentation and marker slot width
  const indentPt = (block.indentPx / 96) * 72; // CSS px ≈ 96dpi → pt
  const ownMarkerWidth = block.marker
    ? measure(block.marker, markerMeasureStyle)
    : 0;
  
  // Use shared marker column width for list groups
  const markerSlotPt =
    block.listGroupId != null && options.markerSlotByGroup
      ? (options.markerSlotByGroup.get(block.listGroupId) ?? ownMarkerWidth)
      : ownMarkerWidth;
  
  const maxWidth = Math.max(20, widthPt - indentPt - markerSlotPt);

  // Split text into pieces for word-wrapping
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

  // Word wrap algorithm
  for (const piece of pieces) {
    const w = measure(piece.text, piece.style);
    
    // If piece doesn't fit on current line, start new line
    if (lineWidth + w > maxWidth && lineRuns.length > 0) {
      pushLine();
    }
    
    // Handle very long words that exceed max width
    if (w > maxWidth) {
      // Split long word
      const chars = piece.text.split("");
      let currentWord = "";
      
      for (const char of chars) {
        const charWidth = measure(char, piece.style);
        if (lineWidth + charWidth > maxWidth && lineRuns.length > 0) {
          pushLine();
        }
        
        if (currentWord) {
          lineRuns.push({ text: currentWord, style: piece.style });
          lineWidth += measure(currentWord, piece.style);
          currentWord = "";
        }
        
        currentWord = char;
      }
      
      if (currentWord) {
        lineRuns.push({ text: currentWord, style: piece.style });
        lineWidth += measure(currentWord, piece.style);
      }
    } else {
      // Normal word fits (or is first word on line)
      lineRuns.push({ text: piece.text, style: piece.style });
      lineWidth += w;
    }
  }
  
  // Push any remaining content
  if (lineRuns.length > 0 || (isFirstLine && block.marker)) {
    pushLine();
  }

  return lines;
}

/**
 * Calculate marker column widths for list groups.
 * Used to align list markers across wrapped lines.
 */
export function calculateMarkerSlotWidths(
  blocks: WrapBlock[],
  measure: (text: string, style: RichTextRunStyle) => number,
  markerMeasureStyle: RichTextRunStyle
): Map<number, number> {
  const markerSlotByGroup = new Map<number, number>();
  
  for (const block of blocks) {
    if (!block.marker || block.listGroupId == null) continue;
    const w = measure(block.marker, markerMeasureStyle);
    const prev = markerSlotByGroup.get(block.listGroupId) ?? 0;
    if (w > prev) markerSlotByGroup.set(block.listGroupId, w);
  }
  
  return markerSlotByGroup;
}

/**
 * Wrap multiple blocks into lines.
 */
export function wrapBlocksToLines(
  blocks: WrapBlock[],
  options: WrapOptions,
  markerSlotByGroup?: Map<number, number>
): DrawLine[] {
  const { widthMm, measure, markerMeasureStyle } = options;
  const widthPt = widthMm * MM_TO_PT;
  const lines: DrawLine[] = [];

  // Calculate marker slots if not provided
  const markerSlots = markerSlotByGroup ?? calculateMarkerSlotWidths(
    blocks,
    measure,
    markerMeasureStyle
  );

  for (const block of blocks) {
    const blockLines = wrapBlockToLines(block, {
      ...options,
      markerSlotByGroup: markerSlots,
    });
    lines.push(...blockLines);
  }

  return lines;
}