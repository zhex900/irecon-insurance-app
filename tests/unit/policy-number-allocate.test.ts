import { describe, expect, it } from "vitest";

import {
  formatPolicyNumberFromSeq,
  lowestFreePolicyNumberSuffix,
  POLICY_NUMBER_SUFFIX_MAX,
  POLICY_NUMBER_SUFFIX_MIN,
} from "~/lib/policies/policy-number";

describe("lowestFreePolicyNumberSuffix (gap-fill)", () => {
  it("returns min when nothing is used", () => {
    expect(lowestFreePolicyNumberSuffix([])).toBe(POLICY_NUMBER_SUFFIX_MIN);
    expect(formatPolicyNumberFromSeq(POLICY_NUMBER_SUFFIX_MIN)).toBe(
      "ATCCWI1000",
    );
  });

  it("fills the lowest gap before the high-water mark", () => {
    expect(lowestFreePolicyNumberSuffix([10, 11, 20, 40, 41], 10, 99)).toBe(
      12,
    );
    expect(
      lowestFreePolicyNumberSuffix([1000, 1001, 1020, 1040, 1041]),
    ).toBe(1002);
    expect(
      lowestFreePolicyNumberSuffix([1000, 1001, 1002, 1020, 1040, 1041]),
    ).toBe(1003);
  });

  it("returns null when the range is full", () => {
    const full = Array.from(
      { length: POLICY_NUMBER_SUFFIX_MAX - POLICY_NUMBER_SUFFIX_MIN + 1 },
      (_, i) => POLICY_NUMBER_SUFFIX_MIN + i,
    );
    expect(lowestFreePolicyNumberSuffix(full)).toBeNull();
  });

  it("respects custom bounds", () => {
    expect(lowestFreePolicyNumberSuffix([10, 11], 10, 12)).toBe(12);
    expect(lowestFreePolicyNumberSuffix([10, 11, 12], 10, 12)).toBeNull();
  });
});
