/**
 * Geometry and measurement calculations for HTML rich text rendering.
 * Extracted from html-rich-text-lines.ts to reduce file size.
 */

const PT_TO_MM = 25.4 / 72;
const MM_TO_PT = 72 / 25.4;

/**
 * Average glyph width heuristic (pt) matching pdf draw packing closely.
 */
export function heuristicTextWidthPt(text: string, fontSizePt: number): number {
  return Math.max(0, String(text).length) * Math.max(1, fontSizePt) * 0.5;
}

/**
 * First-baseline inset from the box top (mm) — matches html-rich-text-draw.
 */
export function endorsementPaintTopInsetMm(fontSizePt: number): number {
  return Math.max(1, fontSizePt) * 0.85 * PT_TO_MM;
}

/**
 * Vertical distance between baselines (line step).
 */
export function endorsementLineStepMm(
  fontSizePt: number,
  lineHeight: number,
): number {
  return (fontSizePt * lineHeight) / MM_TO_PT;
}

/**
 * Minimum schema height (mm) so one painted baseline fits in the band.
 */
export function minEndorsementPaintBandMm(
  fontSizePt: number,
  _lineHeight: number,
): number {
  return endorsementPaintTopInsetMm(fontSizePt);
}

/**
 * Height required to paint N lines, including the top inset.
 */
export function endorsementPaintHeightForLinesMm(
  lineCount: number,
  fontSizePt: number,
  lineHeight: number,
): number {
  if (lineCount <= 0) return 0;
  const inset = endorsementPaintTopInsetMm(fontSizePt);
  const step = endorsementLineStepMm(fontSizePt, lineHeight);
  // First line sits at the inset; remaining lines need full steps
  return inset + Math.max(0, lineCount - 1) * step;
}

/**
 * Height to reserve for N lines, ensuring no orphaned baselines.
 * Slightly larger than paint height to guarantee all lines fit.
 */
export function endorsementReserveHeightForLinesMm(
  lineCount: number,
  fontSizePt: number,
  lineHeight: number,
): number {
  const paintHeight = endorsementPaintHeightForLinesMm(
    lineCount,
    fontSizePt,
    lineHeight,
  );
  // Add tiny buffer to avoid floating point rounding issues
  return paintHeight + 0.05;
}

export type EndorsementDrawBoxOptions = {
  /** Page floor (mm from page top) - usually page height minus bottom margin */
  pageFloorMm: number;
  /** Reserved space bottom (mm from page top) - where content should stop */
  reservedBottomMm: number;
  /** Line step in mm (vertical distance between baselines) */
  lineStepMm: number;
};

/**
 * Calculate the lowest Y position (from page top) where ink can be drawn
 * without exceeding the reserved space.
 */
export function endorsementDrawBoxBottomMm(
  opts: EndorsementDrawBoxOptions,
): number {
  const { pageFloorMm, reservedBottomMm, lineStepMm } = opts;

  // Content must stop above both the page floor and reserved bottom
  const limit = Math.min(pageFloorMm, reservedBottomMm);

  // Ensure at least one line step remains above the limit
  return Math.max(0, limit - lineStepMm);
}

/**
 * Estimate how many lines fit in a vertical band of given height.
 */
export function countLinesFittingInBandMm(
  bandHeightMm: number,
  fontSizePt: number,
  lineHeight: number,
): number {
  if (bandHeightMm <= 0) return 0;

  const minBand = minEndorsementPaintBandMm(fontSizePt, lineHeight);
  if (bandHeightMm < minBand) return 0;

  const inset = endorsementPaintTopInsetMm(fontSizePt);
  const step = endorsementLineStepMm(fontSizePt, lineHeight);

  // First line consumes the inset
  const remaining = bandHeightMm - inset;
  if (remaining < 0) return 0;

  // Remaining lines consume full steps
  const extraLines = Math.floor(remaining / step);
  return 1 + extraLines;
}

/**
 * Split a total line count into page-based chunks, respecting page height limits.
 */
export function splitLineCountsIntoPages(
  totalLines: number,
  firstMaxMm: number,
  pageMaxMm: number,
  fontSizePt: number,
  lineHeight: number,
): number[] {
  if (totalLines <= 0) return [];

  const chunks: number[] = [];
  let remaining = totalLines;

  // First page (potentially shorter)
  const firstCapacity = countLinesFittingInBandMm(
    firstMaxMm,
    fontSizePt,
    lineHeight,
  );
  if (firstCapacity > 0) {
    const firstChunk = Math.min(remaining, firstCapacity);
    chunks.push(firstChunk);
    remaining -= firstChunk;
  }

  // Subsequent pages (full height)
  const pageCapacity = countLinesFittingInBandMm(
    pageMaxMm,
    fontSizePt,
    lineHeight,
  );
  while (remaining > 0 && pageCapacity > 0) {
    const chunk = Math.min(remaining, pageCapacity);
    chunks.push(chunk);
    remaining -= chunk;
  }

  return chunks;
}

/**
 * Split a total height into page-based chunks, respecting page height limits.
 * Alternative to splitLineCountsIntoPages when working with mm heights directly.
 */
export function splitHeightIntoPageChunks(
  totalHeightMm: number,
  firstMaxMm: number,
  pageMaxMm: number,
): number[] {
  if (totalHeightMm <= 0) return [];

  const chunks: number[] = [];
  let remaining = totalHeightMm;

  // First page (potentially shorter)
  if (firstMaxMm > 0) {
    const firstChunk = Math.min(remaining, firstMaxMm);
    chunks.push(firstChunk);
    remaining -= firstChunk;
  }

  // Subsequent pages (full height)
  while (remaining > 0) {
    const chunk = Math.min(remaining, pageMaxMm);
    chunks.push(chunk);
    remaining -= chunk;
  }

  return chunks;
}
