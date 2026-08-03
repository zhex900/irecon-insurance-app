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
import type { Template } from "@pdfme/common";

function blankTemplate(schemas: Template["schemas"]): Template {
  return {
    basePdf: {
      width: 210,
      height: 297,
      padding: [10, 10, 10, 10],
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

  it("moves a whole block to the next page when it does not fit", () => {
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
          content: "A long body that needs space below the first block.",
        },
      ]),
    };
    const next = expandEndorsementPairSchemas(template, inputs);
    expect(next.schemas.length).toBeGreaterThan(1);
    const page2Names = next.schemas[1]!.map((s) => s.name);
    expect(page2Names).toContain(`${ENDORSEMENT_SUBJECT_FIELD}__2`);
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
