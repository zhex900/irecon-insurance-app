import { describe, expect, it } from "vitest";
import { applyManualPremiumEdit } from "~/lib/premium-manual-recalc";
import type { PremiumBreakdown, RatingSnapshot } from "~/lib/db/types";

function rating(overrides: Partial<RatingSnapshot> = {}): RatingSnapshot {
  return {
    priceId: 1,
    stampDutyId: 1,
    eslId: 1,
    plantRate: 0,
    eslRate: 0.2,
    plantEslRate: 0.2,
    contractWorksStampDutyRate: 0.09,
    liabilityStampDutyRate: 0.09,
    contractWorksAppliedRate: 0.001,
    liabilityAppliedRate: 0.0005,
    contractWorksMinPremium: 500,
    liabilityMinPremium: 250,
    plantValueMin: 0,
    plantValueMax: 0,
    terrorismRate: 0.053,
    terrorismTier: "B",
    isTerrorismRateExist: true,
    ...overrides,
  };
}

function premium(overrides: Partial<PremiumBreakdown> = {}): PremiumBreakdown {
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
    contractWorksTotalPremium: 0,
    liabilityCalculatedBasePremium: 500,
    liabilityBasePremium: 500,
    liabilityESL: 0,
    liabilityGST: 50,
    liabilityStampDuty: 49.5,
    liabilityTotalPremium: 599.5,
    combinedBrokerFee: 100,
    originalTotalPremium: 0,
    ...overrides,
  };
}

describe("applyManualPremiumEdit — contract works True Base", () => {
  it("recalculates terrorism, ESL, GST, SD, section total, and combined", () => {
    const base = 6700;
    const τ = 0.053;
    const e = 0.2;
    const s1 = 0.09;
    const terror = Math.round(base * τ * 100) / 100; // 355.1
    const esl = Math.round((base + terror) * e * 100) / 100;
    const gst = Math.round((base + terror + esl) * 0.1 * 100) / 100;
    const sd = Math.round((base + terror + esl + gst) * s1 * 100) / 100;
    const cwTotal = Math.round((base + terror + esl + gst + sd) * 100) / 100;

    const result = applyManualPremiumEdit({
      premium: premium(),
      rating: rating({ terrorismRate: τ, eslRate: e }),
      key: "contractWorksBasePremium",
      value: base,
      manualTaxOverride: false,
    });

    expect(result.premium.contractWorksBasePremium).toBe(base);
    expect(result.premium.contractWorksTerrorismPremium).toBe(terror);
    expect(result.premium.contractWorksESL).toBe(esl);
    expect(result.premium.contractWorksGST).toBe(gst);
    expect(result.premium.contractWorksStampDuty).toBe(sd);
    expect(result.premium.contractWorksTotalPremium).toBe(cwTotal);
    expect(result.premium.originalTotalPremium).toBe(
      Math.round(
        (cwTotal +
          result.premium.liabilityTotalPremium +
          result.premium.combinedBrokerFee) *
          100,
      ) / 100,
    );
    expect(result.manualTaxOverride).toBe(false);
  });

  it("floors True Base to the contract works minimum premium", () => {
    const result = applyManualPremiumEdit({
      premium: premium(),
      rating: rating({ contractWorksMinPremium: 800 }),
      key: "contractWorksBasePremium",
      value: 100,
      manualTaxOverride: false,
    });
    expect(result.premium.contractWorksBasePremium).toBe(800);
  });

  it("folds Display Homes / Existing Structure terrorism into the levy", () => {
    const base = 1000;
    const dh = 200;
    const es = 100;
    const τ = 0.05;
    const terror = Math.round((base * τ + es * τ + dh * τ) * 100) / 100;

    const result = applyManualPremiumEdit({
      premium: premium({
        contractWorksDisplayHomesPremium: dh,
        contractWorksExistingStructurePremium: es,
      }),
      rating: rating({ terrorismRate: τ, eslRate: 0 }),
      key: "contractWorksBasePremium",
      value: base,
      manualTaxOverride: false,
    });

    expect(result.premium.contractWorksTerrorismPremium).toBe(terror);
    // ESL = (base + terror + es + dh) × 0
    expect(result.premium.contractWorksESL).toBe(0);
  });

  it("keeps ESL/SD when ManualTaxOverride is set, but still refreshes GST", () => {
    const result = applyManualPremiumEdit({
      premium: premium({
        contractWorksESL: 12,
        contractWorksStampDuty: 34,
        contractWorksGST: 1,
      }),
      rating: rating(),
      key: "contractWorksBasePremium",
      value: 1000,
      manualTaxOverride: true,
    });

    expect(result.premium.contractWorksESL).toBe(12);
    expect(result.premium.contractWorksStampDuty).toBe(34);
    expect(result.premium.contractWorksGST).not.toBe(1);
    expect(result.manualTaxOverride).toBe(true);
  });

  it("locks tax override when ESL is edited directly", () => {
    const result = applyManualPremiumEdit({
      premium: premium(),
      rating: rating(),
      key: "contractWorksESL",
      value: 99,
      manualTaxOverride: false,
    });
    expect(result.premium.contractWorksESL).toBe(99);
    expect(result.manualTaxOverride).toBe(true);
  });
});

describe("applyManualPremiumEdit — liability True Base", () => {
  it("recalculates liability GST, SD, and totals", () => {
    const base = 1000;
    const gst = 100;
    const sd = Math.round((base + gst) * 0.09 * 100) / 100;

    const result = applyManualPremiumEdit({
      premium: premium(),
      rating: rating(),
      key: "liabilityBasePremium",
      value: base,
      manualTaxOverride: false,
    });

    expect(result.premium.liabilityBasePremium).toBe(base);
    expect(result.premium.liabilityGST).toBe(gst);
    expect(result.premium.liabilityStampDuty).toBe(sd);
    expect(result.premium.liabilityTotalPremium).toBe(
      Math.round((base + gst + sd) * 100) / 100,
    );
  });
});
