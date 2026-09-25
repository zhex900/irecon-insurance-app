import { describe, expect, it } from "vitest";

import {
  canonicalPolicyNumber,
  formatPolicyNumberFromSeq,
  incrementPolicyNumber,
  POLICY_NUMBER_PREFIX,
  POLICY_NUMBER_SUFFIX_LENGTH,
  validatePolicyNumberInput,
} from "~/lib/policies/policy-number";

describe("policy number length (legacy ATCCWI####)", () => {
  it("uses a 4-digit suffix and 10-character full number", () => {
    expect(POLICY_NUMBER_PREFIX.length + POLICY_NUMBER_SUFFIX_LENGTH).toBe(10);
    expect(formatPolicyNumberFromSeq(487)).toBe("ATCCWI0487");
    expect(canonicalPolicyNumber("487")).toBe("ATCCWI0487");
  });

  it("rejects suffixes longer than four digits", () => {
    const result = validatePolicyNumberInput("12345");
    expect(result.ok).toBe(false);
  });

  it("increments while keeping width", () => {
    expect(incrementPolicyNumber("ATCCWI0487")).toBe("ATCCWI0488");
    expect(incrementPolicyNumber("ATCCWI9998")).toBe("ATCCWI9999");
    expect(() => incrementPolicyNumber("ATCCWI9999")).toThrow(
      /sequence exhausted/i,
    );
  });
});
