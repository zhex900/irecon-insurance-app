import { describe, expect, it } from "vitest";
import {
  calculateCarAdjustment,
  validateAdjustmentFinish,
} from "~/server/pricing/car-adjustment-calculator";
import type { PremiumBreakdown, RatingSnapshot } from "~/lib/db/types";

/** Minimal snapshotted premium for adjustment math (section bases only matter). */
function premium(partial: Partial<PremiumBreakdown> = {}): PremiumBreakdown {
  return {
    contractWorksCalculatedBasePremium: 1000,
    contractWorksBasePremium: 1000,
    contractWorksPlantPremium: 0,
    contractWorksPlantESL: 0,
    contractWorksESL: 0,
    contractWorksGST: 0,
    contractWorksStampDuty: 0,
    contractWorksTerrorismPremium: 0,
    contractWorksPlantTerrorismPremium: 0,
    contractWorksDisplayHomesPremium: 0,
    contractWorksExistingStructurePremium: 0,
    contractWorksTotalPremium: 1000,
    liabilityCalculatedBasePremium: 500,
    liabilityBasePremium: 500,
    liabilityESL: 0,
    liabilityGST: 0,
    liabilityStampDuty: 0,
    liabilityTotalPremium: 500,
    combinedBrokerFee: 0,
    originalTotalPremium: 1500,
    ...partial,
  };
}

function rating(partial: Partial<RatingSnapshot> = {}): RatingSnapshot {
  return {
    priceId: 1,
    stampDutyId: 1,
    eslId: 1,
    plantRate: 0,
    eslRate: 0,
    plantEslRate: 0,
    contractWorksStampDutyRate: 0,
    liabilityStampDutyRate: 0,
    contractWorksAppliedRate: 0.001,
    liabilityAppliedRate: 0.0005,
    contractWorksMinPremium: 0,
    liabilityMinPremium: 0,
    plantValueMin: 0,
    plantValueMax: 0,
    terrorismRate: 0,
    terrorismTier: "",
    isTerrorismRateExist: false,
    ...partial,
  };
}

describe("calculateCarAdjustment", () => {
  it("caps section base refund at 25% of original base (CAR_PRICING_FORMULAS)", () => {
    // Original S1 base 1000; adjusted turnover yields ~600 → raw delta -400.
    // Cap: -25% of 1000 = -250.
    const breakdown = calculateCarAdjustment({
      originalTurnover: 1_000_000,
      adjustmentTurnover: 600_000,
      stampDutyExempt: false,
      premium: premium({
        contractWorksBasePremium: 1000,
        liabilityBasePremium: 500,
      }),
      rating: rating({
        contractWorksAppliedRate: 0.001, // 600_000 * 0.001 = 600
        liabilityAppliedRate: 0.0005, // 600_000 * 0.0005 = 300
        contractWorksMinPremium: 0,
        liabilityMinPremium: 0,
        eslRate: 0,
        contractWorksStampDutyRate: 0,
        liabilityStampDutyRate: 0,
        terrorismRate: 0,
      }),
    });

    expect(breakdown.delta.section1.trueBasePremium).toBe(-250);
    expect(breakdown.delta.section2.trueBasePremium).toBe(-125);
  });

  it("allows full decrease when under the 25% cap", () => {
    const breakdown = calculateCarAdjustment({
      originalTurnover: 1_000_000,
      adjustmentTurnover: 900_000,
      stampDutyExempt: false,
      premium: premium({
        contractWorksBasePremium: 1000,
        liabilityBasePremium: 500,
      }),
      rating: rating({
        contractWorksAppliedRate: 0.001, // 900
        liabilityAppliedRate: 0.0005, // 450
        contractWorksMinPremium: 0,
        liabilityMinPremium: 0,
      }),
    });

    expect(breakdown.delta.section1.trueBasePremium).toBe(-100);
    expect(breakdown.delta.section2.trueBasePremium).toBe(-50);
  });

  it("applies GST at 10% on section totals", () => {
    const breakdown = calculateCarAdjustment({
      originalTurnover: 100_000,
      adjustmentTurnover: 100_000,
      stampDutyExempt: false,
      premium: premium({
        contractWorksBasePremium: 1000,
        contractWorksTerrorismPremium: 0,
        liabilityBasePremium: 0,
      }),
      rating: rating({
        contractWorksAppliedRate: 0.01,
        liabilityAppliedRate: 0,
        contractWorksMinPremium: 1000,
        liabilityMinPremium: 0,
        eslRate: 0,
        terrorismRate: 0,
      }),
    });

    // Unchanged turnover → delta bases ~0; GST on original section1 = 1000 * 0.1
    expect(breakdown.original.section1.gst).toBe(100);
    expect(breakdown.original.section1.totalPremium).toBe(1100);
  });
});

describe("validateAdjustmentFinish", () => {
  it("blocks return premium over 75% of original (75% floor)", () => {
    const breakdown = calculateCarAdjustment({
      originalTurnover: 1_000_000,
      adjustmentTurnover: 1,
      stampDutyExempt: false,
      premium: premium({
        contractWorksBasePremium: 10_000,
        liabilityBasePremium: 0,
      }),
      rating: rating({
        contractWorksAppliedRate: 0,
        liabilityAppliedRate: 0,
        contractWorksMinPremium: 0,
        liabilityMinPremium: 0,
      }),
    });

    // Cap limits delta base to -25% so finish may still pass — force a synthetic check:
    const oversized = {
      ...breakdown,
      delta: {
        ...breakdown.delta,
        total: {
          ...breakdown.delta.total,
          totalPremium: -(breakdown.original.total.totalPremium * 0.8),
        },
      },
    };

    expect(validateAdjustmentFinish(oversized)).toMatch(/75%/);
  });

  it("allows finish when return is within 75% floor", () => {
    const breakdown = calculateCarAdjustment({
      originalTurnover: 1_000_000,
      adjustmentTurnover: 950_000,
      stampDutyExempt: false,
      premium: premium(),
      rating: rating({
        contractWorksAppliedRate: 0.001,
        liabilityAppliedRate: 0.0005,
      }),
    });

    expect(validateAdjustmentFinish(breakdown)).toBeNull();
  });
});
