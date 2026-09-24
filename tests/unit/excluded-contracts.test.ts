import { describe, expect, it } from "vitest";

import {
  buildExcludedContracts2Activities,
  syncExcludedContracts2Periods,
} from "~/lib/policies/excluded-contracts";

describe("excluded contracts construction period wording", () => {
  it("builds default text with eighteen (18) months", () => {
    const text = buildExcludedContracts2Activities(18, 12);
    expect(text).toContain(
      "With a construction period exceeding eighteen (18) months",
    );
  });

  it("syncs the construction bullet when maximum construction period changes", () => {
    const original = buildExcludedContracts2Activities(18, 12);
    const updated = syncExcludedContracts2Periods(original, 12, 12);
    expect(updated).toContain(
      "With a construction period exceeding twelve (12) months",
    );
    expect(updated).not.toContain("eighteen (18)");
    expect(updated).toContain(
      "With a maintenance/defects liability period exceeding twelve (12) months",
    );
  });

  it("leaves customized text alone when the standard bullet is missing", () => {
    const custom = "Custom excluded activities only.";
    expect(syncExcludedContracts2Periods(custom, 12, 12)).toBe(custom);
  });

  it("syncs the maintenance bullet when maximum maintenance period changes", () => {
    const original = buildExcludedContracts2Activities(18, 12);
    const updated = syncExcludedContracts2Periods(original, 18, 6);
    expect(updated).toContain(
      "With a maintenance/defects liability period exceeding six (6) months",
    );
    expect(updated).not.toContain("twelve (12) months; or");
    expect(updated).toContain("eighteen (18) months");
  });
});
