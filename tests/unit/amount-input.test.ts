import { describe, expect, it } from "vitest";

import { formatAmountInput, sanitizeAmountInput } from "~/lib/amount-input";

describe("formatAmountInput", () => {
  it("adds thousands separators", () => {
    expect(formatAmountInput(1234)).toBe("1,234");
    expect(formatAmountInput("1234567.89")).toBe("1,234,567.89");
  });

  it("preserves a trailing decimal while typing", () => {
    expect(formatAmountInput("1234.")).toBe("1,234.");
  });
});

describe("sanitizeAmountInput", () => {
  it("strips commas and non-numeric characters", () => {
    expect(sanitizeAmountInput("1,234.56")).toBe("1234.56");
    expect(sanitizeAmountInput("abc12.3.4")).toBe("12.34");
  });
});
