import { describe, expect, it } from "vitest";

import type { CarExcesses } from "~/lib/db/types";
import {
  activeBandExcessAmounts,
  CONTRACT_VALUE_BAND_LABEL,
  contractValueBandLabel,
} from "~/lib/policies/excesses";

const excesses: Pick<
  CarExcesses,
  | "excessUpTo2MMinorPerils"
  | "excessUpTo2MMajorPerils"
  | "excessOver2MMinorPerils"
  | "excessOver2MMajorPerils"
  | "excessUpTo2MLimit10M"
  | "excessUpTo2MLimit20M"
  | "excessOver2MLimit10M"
  | "excessOver2MLimit20M"
> = {
  excessUpTo2MMinorPerils: "2500",
  excessUpTo2MMajorPerils: "5000",
  excessOver2MMinorPerils: "7500",
  excessOver2MMajorPerils: "10000",
  excessUpTo2MLimit10M: "1000",
  excessUpTo2MLimit20M: "2000",
  excessOver2MLimit10M: "3000",
  excessOver2MLimit20M: "4000",
};

describe("contractValueBandLabel", () => {
  it("returns up-to-$2M label for turnover at or below 2,000,000", () => {
    expect(contractValueBandLabel(2_000_000)).toBe(
      CONTRACT_VALUE_BAND_LABEL.upTo2m,
    );
    expect(contractValueBandLabel("1,500,000")).toBe(
      CONTRACT_VALUE_BAND_LABEL.upTo2m,
    );
  });

  it("returns $2,000,001 to $5,000,000 label above 2,000,000", () => {
    expect(contractValueBandLabel(2_000_001)).toBe(
      CONTRACT_VALUE_BAND_LABEL.from2mTo5m,
    );
  });

  it("returns empty when turnover is missing", () => {
    expect(contractValueBandLabel(undefined)).toBe("");
    expect(contractValueBandLabel("")).toBe("");
  });
});

describe("activeBandExcessAmounts", () => {
  it("picks UpTo2M amounts for turnover ≤ 2M", () => {
    expect(activeBandExcessAmounts(excesses, 1_000_000)).toEqual({
      minorPerils: "2500",
      majorPerils: "5000",
      limit10M: "1000",
      limit20M: "2000",
    });
  });

  it("picks Over2M amounts for turnover > 2M", () => {
    expect(activeBandExcessAmounts(excesses, 3_000_000)).toEqual({
      minorPerils: "7500",
      majorPerils: "10000",
      limit10M: "3000",
      limit20M: "4000",
    });
  });

  it("returns empty strings when turnover does not resolve", () => {
    expect(activeBandExcessAmounts(excesses, "")).toEqual({
      minorPerils: "",
      majorPerils: "",
      limit10M: "",
      limit20M: "",
    });
  });
});
