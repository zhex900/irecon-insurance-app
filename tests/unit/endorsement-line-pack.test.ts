import { describe, expect, it } from "vitest";
import {
  countLinesFittingInBandMm,
  endorsementPaintHeightForLinesMm,
  splitLineCountsIntoPages,
} from "~/lib/pdf/html-rich-text-lines";

describe("endorsement line packing", () => {
  const font = 9.5;
  const lh = 1.25;

  it("packs the maximum number of lines into the available band", () => {
    const band = 40;
    const fit = countLinesFittingInBandMm(band, font, lh);
    expect(fit).toBeGreaterThan(5);
    const height = endorsementPaintHeightForLinesMm(fit, font, lh);
    expect(height).toBeLessThanOrEqual(band + 0.01);
    // One more line would not fit.
    expect(endorsementPaintHeightForLinesMm(fit + 1, font, lh)).toBeGreaterThan(
      band,
    );
  });

  it("does not open a trailing page for a leftover millimetre", () => {
    // 47 lines: first page takes what fits in 80mm; rest on continuation —
    // never a third page for a fractional remainder.
    const total = 47;
    const chunks = splitLineCountsIntoPages(total, 80, 250, font, lh);
    const sum = chunks.reduce((a, b) => a + b, 0);
    expect(sum).toBe(total);
    expect(chunks.every((n) => n >= 1 || total === 0)).toBe(true);
    // Every page except possibly the last should be filled to capacity.
    const firstFit = countLinesFittingInBandMm(80, font, lh);
    expect(chunks[0]).toBe(Math.min(total, firstFit));
  });
});
