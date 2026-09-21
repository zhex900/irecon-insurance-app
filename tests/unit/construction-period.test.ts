import { describe, expect, it } from "vitest";

import { deriveMaximumConstructionPeriod } from "~/lib/policies/construction-period";

describe("deriveMaximumConstructionPeriod", () => {
  it("returns 18 months for Annual Transfer or unset annual type", () => {
    expect(deriveMaximumConstructionPeriod(1, 1)).toBe(18);
    expect(deriveMaximumConstructionPeriod(1, null)).toBe(18);
    expect(deriveMaximumConstructionPeriod(1)).toBe(18);
  });

  it("returns 12 months for Annual Contract Commencing", () => {
    expect(deriveMaximumConstructionPeriod(1, 2)).toBe(12);
  });

  it("returns 12 months for Single and Owner Builder cover", () => {
    expect(deriveMaximumConstructionPeriod(2)).toBe(12);
    expect(deriveMaximumConstructionPeriod(3)).toBe(12);
  });
});
