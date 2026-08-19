import { describe, expect, it } from "vitest";

import {
  buildApiSearchUrl,
  CLIENT_PICKER_SEARCH_PARAMS,
  GLOBAL_SEARCH_PARAMS,
} from "~/lib/search/api-search";

describe("buildApiSearchUrl", () => {
  it("builds global search URLs", () => {
    expect(buildApiSearchUrl("acme", GLOBAL_SEARCH_PARAMS)).toBe(
      "/api/search?q=acme&limit=8",
    );
  });

  it("builds typed client picker URLs", () => {
    expect(buildApiSearchUrl("broker", CLIENT_PICKER_SEARCH_PARAMS)).toBe(
      "/api/search?q=broker&type=clients&limit=25",
    );
  });

  it("encodes query text", () => {
    expect(buildApiSearchUrl("a&b c")).toBe("/api/search?q=a%26b+c");
  });
});
