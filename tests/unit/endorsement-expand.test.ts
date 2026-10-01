import type { Template } from "@pdfme/common";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_ENDORSEMENT_BLOCK_GAP_MM,
  ENDORSEMENT_BLOCK_GAP_KEY,
  ENDORSEMENT_CONTENT_FIELD,
  ENDORSEMENT_SUBJECT_FIELD,
  expandEndorsementPairSchemas,
  parseEndorsementPairsFromInputs,
  readEndorsementBlockGapMm,
  setEndorsementBlockGapMm,
} from "~/lib/pdf/endorsement-expand";
import { endorsementsTableContent } from "~/lib/pdf/merge-fields";

function blankTemplate(schemas: Template["schemas"]): Template {
  return {
    basePdf: {
      width: 210,
      height: 297,
      padding: [10, 10, 10, 10] as [number, number, number, number],
    },
    schemas,
  };
}

describe("parseEndorsementPairsFromInputs", () => {
  it("reads rows from Endorsements JSON", () => {
    const pairs = parseEndorsementPairsFromInputs({
      Endorsements: endorsementsTableContent([
        { subject: "A", content: "Body A" },
        { subject: "B", content: "Body B" },
      ]),
    });
    expect(pairs).toEqual([
      { subject: "A", content: "Body A" },
      { subject: "B", content: "Body B" },
    ]);
  });

  it("ignores blank placeholder rows", () => {
    expect(
      parseEndorsementPairsFromInputs({
        Endorsements: JSON.stringify([["", ""]]),
      }),
    ).toEqual([]);
  });
});

describe("expandEndorsementPairSchemas", () => {
  const subject = {
    name: ENDORSEMENT_SUBJECT_FIELD,
    type: "text",
    position: { x: 12, y: 40 },
    width: 185,
    height: 6,
    fontSize: 11,
    lineHeight: 1.15,
    [ENDORSEMENT_BLOCK_GAP_KEY]: 5,
  };
  const content = {
    name: ENDORSEMENT_CONTENT_FIELD,
    type: "text",
    position: { x: 12, y: 48 },
    width: 185,
    height: 10,
    fontSize: 9.5,
    lineHeight: 1.25,
  };

  it("hides both fields when the list is empty", () => {
    const template = blankTemplate([
      [
        subject,
        content,
        {
          name: "PolicyNumber",
          type: "text",
          position: { x: 12, y: 80 },
          width: 40,
          height: 5,
        },
      ],
    ]);
    const inputs = { Endorsements: JSON.stringify([["", ""]]) };
    const next = expandEndorsementPairSchemas(template, inputs);
    const names = next.schemas[0]!.map((s) => s.name);
    expect(names).toEqual(["PolicyNumber"]);
  });

  it("clones the pair once per wording and collects rich draw ops", () => {
    const template = blankTemplate([[subject, content]]);
    const inputs = {
      Endorsements: endorsementsTableContent([
        { subject: "One", content: "First body" },
        { subject: "Two", content: "Second body" },
      ]),
    };
    const drawOps: Array<{ html: string; pageIndex: number }> = [];
    const next = expandEndorsementPairSchemas(template, inputs, drawOps);
    const names = next.schemas[0]!.map((s) => s.name);
    expect(names).toContain(ENDORSEMENT_SUBJECT_FIELD);
    expect(names).toContain(ENDORSEMENT_CONTENT_FIELD);
    expect(names).toContain(`${ENDORSEMENT_SUBJECT_FIELD}__2`);
    expect(names).toContain(`${ENDORSEMENT_CONTENT_FIELD}__2`);
    // Plain text stays in pdfme inputs; HTML would go to draw ops.
    expect(inputs[ENDORSEMENT_SUBJECT_FIELD]).toBe("One");
    expect(inputs[`${ENDORSEMENT_SUBJECT_FIELD}__2`]).toBe("Two");
    expect(drawOps).toEqual([]);
  });

  it("removes fixed customEndorsementSubject/Content when expand runs", () => {
    const customSubject = {
      name: "customEndorsementSubject",
      type: "text",
      position: { x: 12, y: 200 },
      width: 185,
      height: 6,
      fontSize: 11,
    };
    const customContent = {
      name: "customEndorsementContent",
      type: "text",
      position: { x: 12, y: 210 },
      width: 185,
      height: 20,
      fontSize: 9.5,
    };
    const template = blankTemplate([
      [subject, content, customSubject, customContent],
    ]);
    const inputs = {
      Endorsements: endorsementsTableContent([
        { subject: "Cat", content: "Catalogue body" },
        {
          subject: "<p><strong>Custom</strong></p>",
          content: "<p>Custom body</p>",
        },
      ]),
      customEndorsementSubject: "<p><strong>Custom</strong></p>",
      customEndorsementContent: "<p>Custom body</p>",
    };
    const next = expandEndorsementPairSchemas(template, inputs);
    const names = next.schemas.flat().map((s) => s.name);
    expect(names).not.toContain("customEndorsementSubject");
    expect(names).not.toContain("customEndorsementContent");
    expect(inputs.customEndorsementSubject).toBeUndefined();
    expect(inputs.customEndorsementContent).toBeUndefined();
    expect(names).toContain(`${ENDORSEMENT_SUBJECT_FIELD}__2`);
    expect(names).toContain(`${ENDORSEMENT_CONTENT_FIELD}__2`);
  });

  it("collects draw ops for HTML wording without pdfme double-paint", () => {
    const template = blankTemplate([[subject, content]]);
    const inputs = {
      Endorsements: endorsementsTableContent([
        {
          subject: "<p><strong>One</strong></p>",
          content: '<ul data-list-style="dash"><li>Body</li></ul>',
        },
      ]),
    };
    const drawOps: Array<{ html: string }> = [];
    expandEndorsementPairSchemas(template, inputs, drawOps);
    // HTML is overlay-only — empty pdfme content avoids a darker double draw.
    expect(inputs[ENDORSEMENT_SUBJECT_FIELD]).toBe("");
    expect(inputs[ENDORSEMENT_CONTENT_FIELD]).toBe("");
    expect(drawOps.map((op) => op.html)).toEqual([
      "<p><strong>One</strong></p>",
      '<ul data-list-style="dash"><li>Body</li></ul>',
    ]);
  });

  it("reserves continuation pages for tall HTML content", () => {
    const template = blankTemplate([[subject, content]]);
    const longBody = `<p><strong>Display Homes</strong></p>${"<p>Line of endorsement wording that wraps.</p>".repeat(80)}`;
    const inputs = {
      Endorsements: endorsementsTableContent([
        {
          subject: "<p><strong>Display Home Wording Endorsement</strong></p>",
          content: longBody,
        },
      ]),
    };
    const drawOps: Array<{ html: string; pageIndex: number }> = [];
    const next = expandEndorsementPairSchemas(template, inputs, drawOps);
    expect(next.schemas.length).toBeGreaterThan(1);
    expect(drawOps.some((op) => op.html.includes("Display Homes"))).toBe(true);
    const contNames = next.schemas.flatMap((page) =>
      page.map((s) => String(s.name ?? "")),
    );
    expect(contNames.some((n) => n.includes("__cont"))).toBe(true);
  });

  it("packs the next HTML endorsement under the last ink, not a full page", () => {
    const template = blankTemplate([[subject, content]]);
    const trenchBody = `<p>${"Incomplete trenches wording. ".repeat(12)}</p>
<ol data-list-style="lower-roman">
<li><p>Subsidence of completed backfill.</p></li>
<li><p>Cleaning pipes not sealed each day.</p></li>
<li><p>Displacement of pipes by water.</p></li>
</ol>`;
    const inputs = {
      Endorsements: endorsementsTableContent([
        {
          subject:
            "<p><strong>Open Trench Limitation (100 metres)</strong></p>",
          content: trenchBody,
        },
        {
          subject: "<p><strong>Vegetation</strong></p>",
          content: "<p>Short vegetation body.</p>",
        },
      ]),
    };
    const next = expandEndorsementPairSchemas(template, inputs, []);
    const vegSubject = next.schemas
      .flatMap((page) => page)
      .find((s) => s.name === `${ENDORSEMENT_SUBJECT_FIELD}__2`) as
      { position?: { y?: number }; name?: string } | undefined;
    expect(vegSubject?.position?.y).toBeTypeOf("number");
    // Must not be parked near the bottom after an overestimated trench box.
    expect(vegSubject!.position!.y!).toBeLessThan(120);
  });

  it("continues packing on the same page instead of jumping a whole block", () => {
    const template = blankTemplate([[subject, content]]);
    const inputs = {
      Endorsements: endorsementsTableContent([
        { subject: "One", content: "Short" },
        {
          subject: "Two",
          content: "A long body that needs space below the first block.",
        },
      ]),
    };
    const next = expandEndorsementPairSchemas(template, inputs);
    const page0 = next.schemas[0]!;
    const oneContent = page0.find(
      (s) => s.name === ENDORSEMENT_CONTENT_FIELD,
    ) as { position?: { y?: number }; height?: number } | undefined;
    const twoSubject = page0.find(
      (s) => s.name === `${ENDORSEMENT_SUBJECT_FIELD}__2`,
    ) as { position?: { y?: number } } | undefined;
    expect(twoSubject).toBeTruthy();
    expect(Number(twoSubject!.position!.y)).toBeCloseTo(
      Number(oneContent!.position!.y) + Number(oneContent!.height) + 5,
      1,
    );
  });

  it("keeps subject and first content lines on the same page when the prototype sits low", () => {
    const lowSubject = { ...subject, position: { x: 12, y: 275 } };
    const lowContent = { ...content, position: { x: 12, y: 283 } };
    const template = blankTemplate([[lowSubject, lowContent]]);
    const inputs = {
      Endorsements: endorsementsTableContent([
        {
          subject: "<p><strong>Low on page</strong></p>",
          content: "<p>Body starts under the subject on the same page.</p>",
        },
      ]),
    };
    const drawOps: Array<{ pageIndex: number; yMm: number; html: string }> = [];
    const next = expandEndorsementPairSchemas(template, inputs, drawOps);
    const sub = next.schemas
      .flatMap((page, pageIndex) => page.map((s) => ({ pageIndex, schema: s })))
      .find((row) => row.schema.name === ENDORSEMENT_SUBJECT_FIELD);
    const body = next.schemas
      .flatMap((page, pageIndex) => page.map((s) => ({ pageIndex, schema: s })))
      .find((row) => row.schema.name === ENDORSEMENT_CONTENT_FIELD);
    expect(sub).toBeTruthy();
    expect(body).toBeTruthy();
    expect(sub!.pageIndex).toBe(body!.pageIndex);
    expect(Number(body!.schema.position?.y)).toBeGreaterThan(
      Number(sub!.schema.position?.y),
    );
    const subjectOp = drawOps.find((op) => op.html.includes("Low on page"));
    const bodyOp = drawOps.find((op) => op.html.includes("Body starts under"));
    expect(subjectOp?.pageIndex).toBe(bodyOp?.pageIndex);
    expect(bodyOp!.yMm).toBeGreaterThan(subjectOp!.yMm);
  });

  it("starts a new page only when the next subject cannot fit above the bottom margin", () => {
    const nearBottomSubject = {
      ...subject,
      position: { x: 12, y: 250 },
    };
    const nearBottomContent = {
      ...content,
      position: { x: 12, y: 258 },
      height: 20,
    };
    const template = blankTemplate([[nearBottomSubject, nearBottomContent]]);
    const inputs = {
      Endorsements: endorsementsTableContent([
        { subject: "One", content: "Short" },
        {
          subject: "Two",
          content: "A long body that needs space below the subject.",
        },
      ]),
    };
    const next = expandEndorsementPairSchemas(template, inputs);
    expect(next.schemas.length).toBeGreaterThan(1);
    const page2 = next.schemas[1]!;
    expect(
      page2.some((s) => s.name === `${ENDORSEMENT_SUBJECT_FIELD}__2`),
    ).toBe(true);
  });

  it("floors short subject boxes to one paintable line (Unsealed Roadworks)", () => {
    const tinySubject = { ...subject, height: 4.5, fontSize: 9.5 };
    const template = blankTemplate([[tinySubject, content]]);
    const inputs = {
      Endorsements: endorsementsTableContent([
        {
          subject: "<p><strong>Unsealed Roadworks</strong></p>",
          content: "<p>Short body.</p>",
        },
      ]),
    };
    const next = expandEndorsementPairSchemas(template, inputs, []);
    const sub = next.schemas[0]!.find(
      (s) => s.name === ENDORSEMENT_SUBJECT_FIELD,
    ) as { height?: number } | undefined;
    // Designer box already clears one baseline; do not inflate to two lines.
    expect(Number(sub!.height)).toBeGreaterThanOrEqual(4.5);
  });

  it("packs like schedule even when the content prototype is tall (rating-single)", () => {
    const tallContent = { ...content, height: 85 };
    const template = blankTemplate([[subject, tallContent]]);
    const inputs = {
      Endorsements: endorsementsTableContent(
        Array.from({ length: 6 }, (_, i) => ({
          subject: `<p><strong>Section ${i + 1}</strong></p>`,
          content: `<p>Short body ${i + 1} for packing.</p>`,
        })),
      ),
    };
    const next = expandEndorsementPairSchemas(template, inputs, []);
    const subjectsOnFirst = next.schemas[0]!.filter((s) =>
      String(s.name ?? "").startsWith(ENDORSEMENT_SUBJECT_FIELD),
    );
    expect(subjectsOnFirst.length).toBeGreaterThanOrEqual(4);
  });

  it("reads and writes editable block gap on the subject prototype", () => {
    const template = blankTemplate([[subject, content]]);
    expect(readEndorsementBlockGapMm(template)).toBe(5);
    const updated = setEndorsementBlockGapMm(template, 8);
    expect(readEndorsementBlockGapMm(updated)).toBe(8);
    expect(readEndorsementBlockGapMm(blankTemplate([[]]))).toBe(
      DEFAULT_ENDORSEMENT_BLOCK_GAP_MM,
    );
  });
});
