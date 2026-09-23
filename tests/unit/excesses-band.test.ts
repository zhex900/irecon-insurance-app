import { describe, expect, it } from "vitest";

import type { CarExcesses } from "~/lib/db/types";
import {
  activeBandExcessAmounts,
  isExcessFieldVisible,
  legalLiabilityExcessValuesFor,
  migrateLegacyExcessKeys,
  normalizeExcesses,
  normalizeExcessValue,
  perilsExcessValuesForLegalLiability,
  relocateExcessesToActiveBand,
  resolveContractValueBand,
  resolveWorkerToWorkerExcess,
} from "~/lib/policies/excesses";
import { referenceData } from "~/lib/reference-data";

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

describe("perilsExcessValuesForLegalLiability", () => {
  const defaults = referenceData.defaultExcesses;

  it("uses reference defaults for $10M limit of liability", () => {
    expect(perilsExcessValuesForLegalLiability(1, defaults)).toEqual({
      excessUpTo2MMinorPerils: "1000",
      excessUpTo2MMajorPerils: "1000",
      excessOver2MMinorPerils: "N/A",
      excessOver2MMajorPerils: "N/A",
    });
  });

  it("uses reference defaults for $20M limit of liability", () => {
    expect(perilsExcessValuesForLegalLiability(2, defaults)).toEqual({
      excessUpTo2MMinorPerils: "N/A",
      excessUpTo2MMajorPerils: "N/A",
      excessOver2MMinorPerils: "2500",
      excessOver2MMajorPerils: "5000",
    });
  });

  it("sets N/A when not insured or limit not selected", () => {
    expect(perilsExcessValuesForLegalLiability(3, defaults)).toMatchObject({
      excessUpTo2MMinorPerils: "N/A",
      excessUpTo2MMajorPerils: "N/A",
    });
    expect(perilsExcessValuesForLegalLiability("", defaults)).toMatchObject({
      excessUpTo2MMinorPerils: "N/A",
      excessUpTo2MMajorPerils: "N/A",
    });
    expect(resolveContractValueBand(0)).toBeNull();
  });
});

describe("legalLiabilityExcessValuesFor", () => {
  const defaults = referenceData.defaultExcesses;

  it("sets all Section 2 excesses to N/A when limit is Not Insured", () => {
    expect(legalLiabilityExcessValuesFor(1_500_000, 3, defaults)).toMatchObject(
      {
        excessWorkerToWorker: "N/A",
        excessUpTo2MLimit10M: "N/A",
        excessUpTo2MLimit20M: "N/A",
      },
    );
  });

  it("applies $1,000 $10M limit excess when contract works ≤ $2M", () => {
    expect(legalLiabilityExcessValuesFor(1_500_000, 1, defaults)).toEqual({
      excessWorkerToWorker: "15000",
      excessUpTo2MLimit10M: "1000",
      excessUpTo2MLimit20M: "N/A",
      excessOver2MLimit10M: "N/A",
      excessOver2MLimit20M: "N/A",
    });
  });

  it("applies $2,500 $10M limit excess when contract works above $2M", () => {
    expect(legalLiabilityExcessValuesFor(2_500_000, 1, defaults)).toEqual({
      excessWorkerToWorker: "15000",
      excessUpTo2MLimit10M: "N/A",
      excessUpTo2MLimit20M: "N/A",
      excessOver2MLimit10M: "2500",
      excessOver2MLimit20M: "N/A",
    });
  });

  it("sets Worker to Worker from estimated turnover up to $10M", () => {
    expect(resolveWorkerToWorkerExcess(10_000_000)).toBe("15000");
    expect(
      legalLiabilityExcessValuesFor(1_500_000, 1, defaults, 10_000_000),
    ).toMatchObject({ excessWorkerToWorker: "15000" });
  });

  it("sets Worker to Worker to $25,000 when estimated turnover exceeds $10M", () => {
    expect(resolveWorkerToWorkerExcess(10_000_001)).toBe("25000");
    expect(
      legalLiabilityExcessValuesFor(1_500_000, 1, defaults, 10_000_001),
    ).toMatchObject({ excessWorkerToWorker: "25000" });
  });

  it("hides limit rows that do not match selected limit of liability", () => {
    expect(
      isExcessFieldVisible(
        {
          key: "excessUpTo2MLimit20M",
          group: "legalLiability",
          label: "$20M",
          band: "upTo2m",
          liabilityLimitMillions: 20,
        },
        { contractWorksSumInsured: 1_500_000, liabilityLimitBand: 1 },
      ),
    ).toBe(false);
    expect(
      isExcessFieldVisible(
        {
          key: "excessUpTo2MMajorPerils",
          group: "contractWorks",
          label: "Major Perils",
          band: "upTo2m",
        },
        { liabilityLimitBand: 1 },
      ),
    ).toBe(true);
    expect(
      isExcessFieldVisible(
        {
          key: "excessOver2MMajorPerils",
          group: "contractWorks",
          label: "Major Perils",
          band: "from2mTo5m",
        },
        { liabilityLimitBand: 1 },
      ),
    ).toBe(false);
    expect(
      isExcessFieldVisible(
        {
          key: "excessUpTo2MMajorPerils",
          group: "contractWorks",
          label: "Major Perils",
          band: "upTo2m",
        },
        { liabilityLimitBand: 3 },
      ),
    ).toBe(true);
    expect(
      isExcessFieldVisible(
        {
          key: "excessOver2MMajorPerils",
          group: "contractWorks",
          label: "Major Perils",
          band: "from2mTo5m",
        },
        { liabilityLimitBand: 3 },
      ),
    ).toBe(false);
  });
});

describe("activeBandExcessAmounts", () => {
  it("picks perils from limit of liability and liability rows from contract works", () => {
    expect(
      activeBandExcessAmounts(excesses, {
        contractWorksSumInsured: 3_000_000,
        liabilityLimitBand: 1,
      }),
    ).toEqual({
      minorPerils: "2500",
      majorPerils: "5000",
      limit10M: "3000",
      limit20M: "N/A",
    });
  });

  it("picks $20M perils and UpTo2M liability when limit is $20M and contract works ≤ 2M", () => {
    expect(
      activeBandExcessAmounts(excesses, {
        contractWorksSumInsured: 1_000_000,
        liabilityLimitBand: 2,
      }),
    ).toEqual({
      minorPerils: "7500",
      majorPerils: "10000",
      limit10M: "N/A",
      limit20M: "2000",
    });
  });

  it("returns N/A when band drivers do not resolve", () => {
    expect(activeBandExcessAmounts(excesses, "")).toEqual({
      minorPerils: "N/A",
      majorPerils: "N/A",
      limit10M: "N/A",
      limit20M: "N/A",
    });
    expect(
      activeBandExcessAmounts(excesses, {
        contractWorksSumInsured: 1_000_000,
        liabilityLimitBand: 2,
      }),
    ).toMatchObject({
      minorPerils: "7500",
      majorPerils: "10000",
      limit10M: "N/A",
      limit20M: "2000",
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
    excessLegalLiabilityAdditionalNotes: "",
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

  it("preserves N/A on current excess fields for saving", () => {
    expect(
      normalizeExcesses({
        excessUpTo2MMinorPerils: "N/A",
        excessUpTo2MMajorPerils: "N/A",
        excessUpTo2MLimit20M: "N/A",
      }),
    ).toMatchObject({
      excessUpTo2MMinorPerils: "N/A",
      excessUpTo2MMajorPerils: "N/A",
      excessUpTo2MLimit20M: "N/A",
    });
  });

  it("relocates perils for $20M limit and liability for high turnover", () => {
    const normalized = normalizeExcesses(legacy19965, {
      contractWorksSumInsured: 4_000_000,
      liabilityLimitBand: 2,
    });
    expect(normalized).toMatchObject({
      excessOver2MMinorPerils: "1000",
      excessOver2MMajorPerils: "1000",
      excessOver2MLimit20M: "2500",
      excessPlantEquipment: "2500",
      excessWorkerToWorker: "15000",
    });
    expect(
      activeBandExcessAmounts(normalized, {
        contractWorksSumInsured: 4_000_000,
        liabilityLimitBand: 2,
      }),
    ).toEqual({
      minorPerils: "1000",
      majorPerils: "1000",
      limit10M: "N/A",
      limit20M: "2500",
    });
  });

  it("maps legacy 2B to $10M limit when populated", () => {
    const legacy = {
      ...legacy19965,
      excessSection2B: "$10,000",
    };
    const normalized = normalizeExcesses(legacy, {
      contractWorksSumInsured: 1_500_000,
      liabilityLimitBand: 1,
    });
    expect(normalized.excessUpTo2MLimit10M).toBe("10000");
    expect(
      relocateExcessesToActiveBand(normalized, {
        contractWorksSumInsured: 1_500_000,
        liabilityLimitBand: 1,
      }),
    ).toEqual(normalized);
  });
});

describe("excess value normalization", () => {
  it("preserves N/A alongside numeric values", () => {
    expect(normalizeExcessValue("N/A")).toBe("N/A");
    expect(normalizeExcessValue("n/a")).toBe("N/A");
    expect(normalizeExcessValue("$2,500")).toBe("2500");
  });
});
