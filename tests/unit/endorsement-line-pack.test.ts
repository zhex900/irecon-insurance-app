import { describe, expect, it } from "vitest";
import {
  countLinesFittingInBandMm,
  endorsementDrawBoxBottomMm,
  endorsementPaintHeightForLinesMm,
  endorsementReserveHeightForLinesMm,
  splitLineCountsIntoPages,
} from "~/lib/pdf/html-rich-text-geometry";

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

  it("stops short last chunks above the next endorsement (no top-line overlap)", () => {
    const pageFloor = 285;
    const step = 4.2;
    // Full-page continuation — stops one line step above the floor.
    expect(
      endorsementDrawBoxBottomMm({
        pageFloorMm: pageFloor,
        reservedBottomMm: pageFloor - 1,
        lineStepMm: step,
      }),
    ).toBe(pageFloor - 1 - step);
    // Short last chunk with Heritage packed below — must not paint to the floor.
    expect(
      endorsementDrawBoxBottomMm({
        pageFloorMm: pageFloor,
        reservedBottomMm: 40,
        lineStepMm: step,
      }),
    ).toBe(40 - step);
  });

  it("reserve height still fits the line count after 0.01mm rounding", () => {
    for (let n = 1; n <= 40; n++) {
      const h = endorsementReserveHeightForLinesMm(n, font, lh);
      expect(countLinesFittingInBandMm(h, font, lh)).toBeGreaterThanOrEqual(n);
      // toFixed(2) as stored on schemas must not drop a line.
      const stored = Number(h.toFixed(2));
      expect(
        countLinesFittingInBandMm(stored, font, lh),
      ).toBeGreaterThanOrEqual(n);
      // Raw paint height alone can under-fit after rounding — that was the bug.
      const raw = endorsementPaintHeightForLinesMm(n, font, lh);
      const rawStored = Number(raw.toFixed(2));
      if (countLinesFittingInBandMm(rawStored, font, lh) < n) {
        expect(stored).toBeGreaterThan(rawStored);
      }
    }
  });
});
