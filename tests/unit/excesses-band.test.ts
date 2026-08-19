import { describe, expect, it } from "vitest";

import type { CarExcesses } from "~/lib/db/types";
import {
  activeBandExcessAmounts,
  CONTRACT_VALUE_BAND_LABEL,
  contractValueBandLabel,
  migrateLegacyExcessKeys,
  normalizeExcesses,
  relocateExcessesToActiveBand,
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

describe("legacy excess migration", () => {
  const legacy19965 = {
    excessSection1A: "$2,500",
    excessSection1B: "$1,000",
    excessSection1C: "N/A",
    excessSection1D: "N/A",
    excessSection1E: "$1,000",
    excessSection2A: "$15,000",
    excessSection2B: "",
    excessSection2C: "N/A",
    excessSection2D: "$2,500",
    excessSection2E: "N/A",
    excessSection2F: "N/A",
    excessAdditionalNotes: "",
  };

  it("maps legacy section keys and skips N/A", () => {
    expect(migrateLegacyExcessKeys(legacy19965)).toMatchObject({
      excessPlantEquipment: "$2,500",
      excessUpTo2MMinorPerils: "$1,000",
      excessUpTo2MMajorPerils: "$1,000",
      excessWorkerToWorker: "$15,000",
      excessUpTo2MLimit20M: "$2,500",
    });
    expect(migrateLegacyExcessKeys(legacy19965)).not.toHaveProperty(
      "excessSection1B",
    );
  });

  it("relocates up-to-2M values into over-2M band for high turnover", () => {
    const normalized = normalizeExcesses(legacy19965, 4_000_000);
    expect(normalized).toMatchObject({
      excessOver2MMinorPerils: "1000",
      excessOver2MMajorPerils: "1000",
      excessOver2MLimit20M: "2500",
      excessPlantEquipment: "2500",
      excessWorkerToWorker: "15000",
    });
    expect(activeBandExcessAmounts(normalized, 4_000_000)).toEqual({
      minorPerils: "1000",
      majorPerils: "1000",
      limit10M: "",
      limit20M: "2500",
    });
  });

  it("maps legacy 2B to $10M limit when populated", () => {
    const legacy = {
      ...legacy19965,
      excessSection2B: "$10,000",
    };
    const normalized = normalizeExcesses(legacy, 1_500_000);
    expect(normalized.excessUpTo2MLimit10M).toBe("10000");
    expect(relocateExcessesToActiveBand(normalized, 1_500_000)).toEqual(
      normalized,
    );
  });
});
