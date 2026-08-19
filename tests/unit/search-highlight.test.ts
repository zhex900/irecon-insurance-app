import { describe, expect, it } from "vitest";

import { fieldMatches, highlightSegments } from "~/lib/search/match";

describe("fieldMatches digit queries", () => {
  it("matches phone digits ignoring formatting", () => {
    expect(fieldMatches("(02) 9123 4567", "029123")).toBe(true);
    expect(fieldMatches("02-9123-4567", "0291")).toBe(true);
    expect(fieldMatches("0412 345 678", "0412345")).toBe(true);
  });

  it("matches ABN digits ignoring spaces", () => {
    expect(fieldMatches("51 123 456 789", "51123456789")).toBe(true);
  });
});

describe("highlightSegments digit queries", () => {
  it("does not insert spaces into unformatted phone matches", () => {
    const segments = highlightSegments("0412345678", "0412");
    expect(segments).toEqual([
      { text: "0412", match: true },
      { text: "345678", match: false },
    ]);
    expect(segments!.map((s) => s.text).join("")).toBe("0412345678");
  });

  it("keeps existing phone formatting inside the match span", () => {
    const segments = highlightSegments("(02) 9123 4567", "029123");
    expect(segments).toEqual([
      { text: "(", match: false },
      { text: "02) 9123", match: true },
      { text: " 4567", match: false },
    ]);
    expect(segments!.map((s) => s.text).join("")).toBe("(02) 9123 4567");
  });

  it("highlights ABN across spaces without adding characters", () => {
    const segments = highlightSegments("51 123 456 789", "51123");
    expect(segments!.map((s) => s.text).join("")).toBe("51 123 456 789");
    expect(segments!.find((s) => s.match)?.text).toBe("51 123");
  });
});
