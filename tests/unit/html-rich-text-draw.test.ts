import { describe, expect, it } from "vitest";
import { htmlToDrawLines } from "~/lib/pdf/html-rich-text-draw";

describe("htmlToDrawLines", () => {
  const measure = (text: string) => text.length * 5;

  it("keeps blank lines from empty paragraphs", () => {
    const lines = htmlToDrawLines(
      "<p><strong>Title</strong></p><p></p><p>Body after gap</p>",
      { fontSizePt: 9.5, family: "Roboto" },
      185,
      measure,
    );
    const texts = lines.map((l) => l.runs.map((r) => r.text).join(""));
    expect(texts[0]).toContain("Title");
    expect(texts.some((t) => t === "")).toBe(true);
    expect(texts.at(-1)).toContain("Body after gap");
  });

  it("keeps hard breaks from br tags", () => {
    const lines = htmlToDrawLines(
      "<p>Line one<br><br>Line two</p>",
      { fontSizePt: 9.5, family: "Roboto" },
      185,
      measure,
    );
    const texts = lines.map((l) => l.runs.map((r) => r.text).join(""));
    expect(texts).toContain("Line one");
    expect(texts).toContain("Line two");
    expect(texts.filter((t) => t === "").length).toBeGreaterThanOrEqual(1);
  });

  it("keeps list markers and indent for TipTap li>p wrapping", () => {
    const lines = htmlToDrawLines(
      "<ol><li><p>First item</p></li><li><p>Second item</p></li></ol>",
      { fontSizePt: 9.5, family: "Roboto" },
      185,
      measure,
    );
    const items = lines.filter((l) => l.runs.some((r) => r.text.trim()));
    expect(items).toHaveLength(2);
    expect(items[0]?.marker).toBe("1. ");
    expect(items[1]?.marker).toBe("2. ");
    expect(items[0]?.indentPx).toBeGreaterThan(0);
    expect(items[1]?.indentPx).toBe(items[0]?.indentPx);
  });

  it("indents nested lists further than the parent", () => {
    const lines = htmlToDrawLines(
      '<ol><li><p>Parent</p><ol data-list-style="lower-alpha"><li><p>Child</p></li></ol></li></ol>',
      { fontSizePt: 9.5, family: "Roboto" },
      185,
      measure,
    );
    const parent = lines.find((l) =>
      l.runs.some((r) => r.text.includes("Parent")),
    );
    const child = lines.find((l) =>
      l.runs.some((r) => r.text.includes("Child")),
    );
    expect(parent?.marker).toBe("1. ");
    expect(child?.marker).toBe("a) ");
    expect(child?.indentPx ?? 0).toBeGreaterThan(parent?.indentPx ?? 0);
  });

  it("keeps listGroupId on wrapped a) lines for hanging indent", () => {
    const long =
      "This is a long lower-alpha list item that should wrap onto a second line so hanging indent can be verified.";
    const lines = htmlToDrawLines(
      `<ol data-list-style="lower-alpha"><li><p>${long}</p></li></ol>`,
      { fontSizePt: 9.5, family: "Roboto" },
      80,
      measure,
    );
    const withMarker = lines.find((l) => l.marker);
    const wrapped = lines.filter((l) => !l.marker && l.runs.length > 0);
    expect(withMarker?.marker).toBe("a) ");
    expect(withMarker?.listGroupId).toBeTypeOf("number");
    expect(wrapped.length).toBeGreaterThan(0);
    for (const line of wrapped) {
      expect(line.listGroupId).toBe(withMarker?.listGroupId);
      // Wrapped body must not start with leftover spaces from the wrap split.
      expect(line.runs[0]?.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("groups roman markers so draw can size the column to (iii)", () => {
    const lines = htmlToDrawLines(
      `<ol data-list-style="lower-roman">
        <li><p>One</p></li>
        <li><p>Two</p></li>
        <li><p>Three</p></li>
      </ol>`,
      { fontSizePt: 9.5, family: "Roboto" },
      185,
      measure,
    );
    const marked = lines.filter((l) => l.marker);
    expect(marked.map((l) => l.marker)).toEqual(["(i) ", "(ii) ", "(iii) "]);
    const groupId = marked[0]?.listGroupId;
    expect(groupId).toBeTypeOf("number");
    for (const line of marked) {
      expect(line.listGroupId).toBe(groupId);
    }
  });

  it("drops trailing empty paragraphs after a list", () => {
    const lines = htmlToDrawLines(
      `<p>Intro</p><ol data-list-style="lower-roman"><li><p>One</p></li><li><p>Two</p></li></ol><p></p><p><br></p>`,
      { fontSizePt: 9.5, family: "Roboto" },
      185,
      measure,
    );
    const last = lines[lines.length - 1];
    expect(last?.marker).toBe("(ii) ");
    expect(last?.runs.some((r) => r.text.includes("Two"))).toBe(true);
    expect(
      lines.some((l) => !l.marker && !l.runs.some((r) => r.text.trim())),
    ).toBe(false);
  });
});
