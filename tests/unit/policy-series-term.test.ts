import { describe, expect, it } from "vitest";

import {
  formatPolicySeriesReference,
  parsePolicySeriesSearch,
  policySeriesTermBadgeLabel,
} from "~/lib/policies/policy-series-term";

describe("policy-series-term", () => {
  it("hides badge for term 0", () => {
    expect(policySeriesTermBadgeLabel(0)).toBeNull();
    expect(formatPolicySeriesReference("ATCCWI1039", 0)).toBe("ATCCWI1039");
  });

  it("shows #1 for second term", () => {
    expect(policySeriesTermBadgeLabel(1)).toBe("#1");
    expect(formatPolicySeriesReference("ATCCWI1039", 1)).toBe("ATCCWI1039#1");
  });

  it("parses series#term search", () => {
    expect(parsePolicySeriesSearch("ATCCWI1039#1")).toEqual({
      kind: "series_term",
      seriesNumber: "ATCCWI1039",
      seriesTerm: 1,
    });
    expect(parsePolicySeriesSearch("ATCCWI1039 #2")).toEqual({
      kind: "series_term",
      seriesNumber: "ATCCWI1039",
      seriesTerm: 2,
    });
    expect(parsePolicySeriesSearch("ATCCWI1039")).toEqual({
      kind: "text",
      query: "ATCCWI1039",
    });
  });
});
