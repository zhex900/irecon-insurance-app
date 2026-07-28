import { describe, expect, it } from "vitest";
import {
  clampPageSize,
  pageRangeLabel,
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
  totalPages,
} from "~/lib/pagination";

describe("parsePagination", () => {
  it("defaults page 1 and size 25", () => {
    const result = parsePagination(new URL("https://example.test/clients"));
    expect(result).toEqual({
      page: 1,
      pageSize: 25,
      limit: 25,
      offset: 0,
    });
  });

  it("reads page and pageSize from query", () => {
    const result = parsePagination(
      new URL("https://example.test/policies?page=3&pageSize=50"),
    );
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
    expect(result.offset).toBe(100);
  });

  it("clamps pageSize to max 100", () => {
    expect(clampPageSize(500)).toBe(100);
    expect(clampPageSize(0)).toBe(25);
  });
});

describe("pagination href helpers", () => {
  it("omits page=1 from pageSearchHref", () => {
    const params = new URLSearchParams("q=acme&page=2");
    expect(pageSearchHref(params, 1)).toBe("?q=acme");
    expect(pageSearchHref(params, 4)).toBe("?q=acme&page=4");
  });

  it("resets page when changing page size", () => {
    const params = new URLSearchParams("page=3&pageSize=25&q=x");
    expect(pageSizeSearchHref(params, 50, 25)).toBe("?pageSize=50&q=x");
    expect(pageSizeSearchHref(params, 25, 25)).toBe("?q=x");
  });

  it("formats range label", () => {
    expect(pageRangeLabel(0, 1, 25)).toBe("Showing 0 of 0");
    expect(pageRangeLabel(40, 2, 25)).toBe("Showing 26–40 of 40");
    expect(totalPages(40, 25)).toBe(2);
  });
});
