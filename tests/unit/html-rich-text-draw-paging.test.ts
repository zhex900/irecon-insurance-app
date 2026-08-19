import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  applyEndorsementRichDrawOps,
  type EndorsementRichDrawOp,
} from "~/lib/pdf/html-rich-text-draw";

describe("endorsement draw page spill", () => {
  it("shifts later ops when spill appends past reserved continuations", async () => {
    const doc = await PDFDocument.create();
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    // 0: cover, 1: body start, 2: reserved continuation, 3: next endorsement
    for (let i = 0; i < 4; i++) doc.addPage([pageWidth, pageHeight]);

    const lines = Array.from(
      { length: 10 },
      (_, i) => `<p>Line ${i + 1} xxxxx xxxxx xxxxx</p>`,
    ).join("");
    const ops: EndorsementRichDrawOp[] = [
      {
        pageIndex: 1,
        xMm: 12,
        yMm: 250,
        widthMm: 180,
        heightMm: 12,
        html: lines,
        fontSizePt: 10,
        fontName: "Roboto",
        fontColor: "#111111",
        lineHeight: 1.2,
        continuationTopMm: 10,
        continuationHeightMm: 250,
        continuationHeightsMm: [12],
        pageLineBudgets: [2, 2],
        pageBottomMarginMm: 10,
      },
      {
        pageIndex: 3,
        xMm: 12,
        yMm: 10,
        widthMm: 180,
        heightMm: 8,
        html: "<p><strong>Heritage Clause</strong></p>",
        fontSizePt: 11,
        fontName: "Roboto Bold",
        fontColor: "#111111",
        lineHeight: 1.15,
        continuationTopMm: 10,
        continuationHeightMm: 250,
        continuationHeightsMm: [],
        pageLineBudgets: [1],
        pageBottomMarginMm: 10,
      },
    ];

    const before = await doc.save();
    await applyEndorsementRichDrawOps(before, ops, {});

    // Budgets cover 4 lines; remaining lines spill past the reserved cont page.
    // Those spills must shift Heritage (layout page 3) forward.
    expect(ops[1]!.pageIndex).toBeGreaterThan(3);
  });
});
