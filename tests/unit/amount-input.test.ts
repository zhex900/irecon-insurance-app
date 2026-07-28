import { describe, expect, it } from "vitest";
import {
  formatAmountInput,
  mapAmountCaret,
  sanitizeAmountInput,
} from "~/lib/amount-input";

describe("mapAmountCaret", () => {
  it("keeps caret after deleting a leading digit", () => {
    // "5,000,000" → delete leading 5 → ",000,000" caret at 0
    const before = ",000,000";
    const formatted = formatAmountInput(sanitizeAmountInput(before));
    expect(formatted).toBe("000,000");
    expect(mapAmountCaret(before, 0, formatted)).toBe(0);
  });

  it("keeps caret when deleting a middle digit", () => {
    // After deleting a digit mid-value, caret stays after the same digit count.
    const before = "5,00,000";
    const caret = 3; // after "5,0"
    const formatted = formatAmountInput(sanitizeAmountInput(before));
    expect(formatted).toBe("500,000");
    expect(mapAmountCaret(before, caret, formatted)).toBe(2);
  });

  it("keeps caret at end when editing the last digit", () => {
    const before = "5,000,00";
    const caret = before.length;
    const formatted = formatAmountInput(sanitizeAmountInput(before));
    expect(formatted).toBe("500,000");
    expect(mapAmountCaret(before, caret, formatted)).toBe(formatted.length);
  });

  it("preserves caret after a trailing decimal", () => {
    const before = "1,234.";
    const caret = before.length;
    const formatted = formatAmountInput(sanitizeAmountInput(before));
    expect(formatted).toBe("1,234.");
    expect(mapAmountCaret(before, caret, formatted)).toBe(formatted.length);
  });
});
