import { describe, expect, it } from "vitest";

import {
  derivePolicyEndDate,
  POLICY_TERM_MONTHS,
} from "~/lib/policies/policy-period";

describe("derivePolicyEndDate", () => {
  it("returns the same calendar day 12 months after inception", () => {
    expect(POLICY_TERM_MONTHS).toBe(12);
    expect(derivePolicyEndDate("2026-07-01")).toBe("2027-07-01");
    expect(derivePolicyEndDate("2026-01-01")).toBe("2027-01-01");
  });

  it("handles month-end clamping like calendar month arithmetic", () => {
    expect(derivePolicyEndDate("2024-01-31")).toBe("2025-01-31");
    expect(derivePolicyEndDate("2024-03-31")).toBe("2025-03-31");
  });
});
