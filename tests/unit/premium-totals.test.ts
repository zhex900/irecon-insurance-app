import { describe, expect, it } from "vitest";
import type { PremiumBreakdown } from "~/lib/db/types";
import {
  brokerFeeExGstFromCombined,
  combinedBasePremiumExGst,
  rollupPremiumTotals,
} from "~/lib/pricing/premium-totals";

function premium(partial: Partial<PremiumBreakdown> = {}): PremiumBreakdown {
  return {
    contractWorksCalculatedBasePremium: 0,
    contractWorksBasePremium: 0,
    contractWorksPlantPremium: 0,
    contractWorksPlantESL: 0,
    contractWorksESL: 0,
    contractWorksGST: 0,
    contractWorksStampDuty: 0,
    contractWorksTerrorismPremium: 0,
    contractWorksPlantTerrorismPremium: 0,
    contractWorksDisplayHomesPremium: 0,
    contractWorksExistingStructurePremium: 0,
    contractWorksTotalPremium: 0,
    liabilityCalculatedBasePremium: 0,
    liabilityBasePremium: 0,
    liabilityESL: 0,
    liabilityGST: 0,
    liabilityStampDuty: 0,
    liabilityTotalPremium: 0,
    combinedBrokerFee: 0,
    originalTotalPremium: 0,
    ...partial,
  };
}

describe("rollupPremiumTotals", () => {
  it("makes contract works total equal the sum of rounded line items", () => {
    // Classic 1¢ drift: round(sum(raw)) ≠ sum(round(raw)).
    // Stored lines are already cents; total must match their sum.
    const lines = {
      contractWorksBasePremium: 3500.0,
      contractWorksTerrorismPremium: 185.5,
      contractWorksPlantPremium: 120.33,
      contractWorksPlantTerrorismPremium: 6.38,
      contractWorksPlantESL: 34.21,
      contractWorksESL: 994.09,
      contractWorksGST: 484.05,
      contractWorksStampDuty: 479.29,
    };
    const sum =
      lines.contractWorksBasePremium +
      lines.contractWorksTerrorismPremium +
      lines.contractWorksPlantPremium +
      lines.contractWorksPlantTerrorismPremium +
      lines.contractWorksPlantESL +
      lines.contractWorksESL +
      lines.contractWorksGST +
      lines.contractWorksStampDuty;

    const rolled = rollupPremiumTotals(
      premium({
        ...lines,
        // Wrong stored total (round of unrounded chain) — must be corrected.
        contractWorksTotalPremium: sum + 0.01,
      }),
    );

    expect(rolled.contractWorksTotalPremium).toBe(Math.round(sum * 100) / 100);
    expect(rolled.contractWorksTotalPremium).not.toBe(sum + 0.01);
  });
});

describe("combinedBasePremiumExGst", () => {
  it("sums contract works and liability base premium", () => {
    expect(combinedBasePremiumExGst(1000, 500)).toBe(1500);
  });
});

describe("brokerFeeExGstFromCombined", () => {
  it("derives ex-GST from combined incl-GST fee at 10%", () => {
    expect(brokerFeeExGstFromCombined(247.5)).toBe(225);
    expect(brokerFeeExGstFromCombined(308)).toBe(280);
  });
});
