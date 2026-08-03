import { describe, expect, it } from "vitest";
import {
  ensureWordingHtml,
  formatWordingListMarker,
  isWordingHtmlEmpty,
  plainTextFromWordingHtml,
  sanitizeWordingHtml,
  wordingHtmlToEstimateText,
} from "~/lib/wording/html";

describe("wording html", () => {
  it("converts plain text to paragraphs", () => {
    expect(ensureWordingHtml("Hello\nWorld")).toBe("<p>Hello</p><p>World</p>");
  });

  it("strips scripts and keeps formatting", () => {
    const html = sanitizeWordingHtml(
      `<p>Safe <strong>bold</strong><script>alert(1)</script></p><ul><li>One</li></ul>`,
    );
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<ul>");
    expect(html).not.toContain("script");
  });

  it("detects empty html", () => {
    expect(isWordingHtmlEmpty("<p></p>")).toBe(true);
    expect(isWordingHtmlEmpty("<p><br></p>")).toBe(true);
    expect(isWordingHtmlEmpty("<p>Hi</p>")).toBe(false);
  });

  it("strips trailing empty paragraphs after lists", () => {
    const html = sanitizeWordingHtml(
      `<p>Intro</p><ol><li><p>One</p></li></ol><p></p><p><br></p>`,
    );
    expect(html.endsWith("</ol>")).toBe(true);
    expect(html).not.toMatch(/<p>\s*<\/p>\s*$/);
  });

  it("plain-text extracts list lines", () => {
    expect(
      plainTextFromWordingHtml("<p>Title</p><ul><li>A</li><li>B</li></ul>"),
    ).toContain("Title");
    expect(wordingHtmlToEstimateText("<ul><li>A</li><li>B</li></ul>")).toMatch(
      /• A/,
    );
  });

  it("keeps data-list-style and formats alpha/roman/dash markers", () => {
    const html = sanitizeWordingHtml(
      `<ol data-list-style="lower-alpha"><li>One</li><li>Two</li></ol>`,
    );
    expect(html).toContain('data-list-style="lower-alpha"');
    expect(
      wordingHtmlToEstimateText(
        `<ol data-list-style="lower-alpha"><li>One</li><li>Two</li></ol>`,
      ),
    ).toBe("a) One\nb) Two");
    expect(
      wordingHtmlToEstimateText(
        `<ol data-list-style="lower-roman"><li>One</li><li>Two</li></ol>`,
      ),
    ).toBe("(i) One\n(ii) Two");
    expect(
      wordingHtmlToEstimateText(`<ul data-list-style="dash"><li>One</li></ul>`),
    ).toBe("- One");
    expect(formatWordingListMarker("lower-alpha", 1)).toBe("a) ");
    expect(formatWordingListMarker("lower-roman", 2)).toBe("(ii) ");
  });
});
