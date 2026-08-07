import { describe, expect, it } from "vitest";
import { applyManualPremiumEdit } from "~/lib/pricing/premium-manual-recalc";
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

describe("applyManualPremiumEdit — corrected vs legacy quirks", () => {
  it("Quirk 1 fixed: True Base keeps ES/DH fold", () => {
    const base = 11250;
    const es = 340;
    const dh = 10;
    const τ = 0.053;
    const terror = Math.round((base + es + dh) * τ * 100) / 100;

    const result = applyManualPremiumEdit({
      premium: premium({
        contractWorksBasePremium: 1250,
        contractWorksTerrorismPremium: 84.8,
        contractWorksExistingStructurePremium: es,
        contractWorksDisplayHomesPremium: dh,
      }),
      rating: rating({ terrorismRate: τ, eslRate: 0.27 }),
      key: "contractWorksBasePremium",
      value: base,
    });

    expect(result.premium.contractWorksTerrorismPremium).toBe(terror);
  });

  it("does not allow True Base to decrease below the current value", () => {
    const result = applyManualPremiumEdit({
      premium: premium({ contractWorksBasePremium: 1000 }),
      rating: rating({ contractWorksMinPremium: 800 }),
      key: "contractWorksBasePremium",
      value: 100,
    });
    expect(result.premium.contractWorksBasePremium).toBe(1000);
  });

  it("floors True Base to the contract works minimum when current is below min", () => {
    const result = applyManualPremiumEdit({
      premium: premium({ contractWorksBasePremium: 100 }),
      rating: rating({ contractWorksMinPremium: 800 }),
      key: "contractWorksBasePremium",
      value: 100,
    });
    expect(result.premium.contractWorksBasePremium).toBe(800);
  });

  it("does not allow liability True Base to decrease", () => {
    const result = applyManualPremiumEdit({
      premium: premium({ liabilityBasePremium: 500 }),
      rating: rating({ liabilityMinPremium: 250 }),
      key: "liabilityBasePremium",
      value: 100,
    });
    expect(result.premium.liabilityBasePremium).toBe(500);
  });

  it("ES/DH edit: display terror = base×τ + ES×τ + DH×τ", () => {
    const base = 1250;
    const es = 10;
    const τ = 0.053;
    const e = 0.27;
    const terror = Math.round((base * τ + es * τ) * 100) / 100;
    const esl = Math.round((base + terror + es) * e * 100) / 100;

    const result = applyManualPremiumEdit({
      premium: premium({
        contractWorksBasePremium: base,
        contractWorksTerrorismPremium: Math.round(base * τ * 100) / 100,
      }),
      rating: rating({ terrorismRate: τ, eslRate: e }),
      key: "contractWorksExistingStructurePremium",
      value: es,
    });

    expect(result.premium.contractWorksTerrorismPremium).toBe(terror);
    expect(result.premium.contractWorksESL).toBe(esl);
  });

  it("Quirk 2 fixed: typed Terrorism Levy sticks; plant terror updates; plant ESL unchanged", () => {
    const base = 1250;
    const plant = 100;
    const plantEsl = 12.34;
    const es = 340;
    const dh = 10;
    const edited = 100;
    const τ = edited / base;
    const plantTerror = Math.round(plant * τ * 100) / 100;

    const result = applyManualPremiumEdit({
      premium: premium({
        contractWorksBasePremium: base,
        contractWorksTerrorismPremium: Math.round(base * 0.053 * 100) / 100,
        contractWorksExistingStructurePremium: es,
        contractWorksDisplayHomesPremium: dh,
        contractWorksPlantPremium: plant,
        contractWorksPlantTerrorismPremium:
          Math.round(plant * 0.053 * 100) / 100,
        contractWorksPlantESL: plantEsl,
      }),
      rating: rating({ terrorismRate: 0.053, eslRate: 0.2 }),
      key: "contractWorksTerrorismPremium",
      value: edited,
    });

    // Legacy would show 128.00 — rebuild keeps 100.00
    expect(result.premium.contractWorksTerrorismPremium).toBe(edited);
    expect(result.premium.contractWorksPlantTerrorismPremium).toBe(plantTerror);
    expect(result.premium.contractWorksPlantESL).toBe(plantEsl);
    expect(result.sessionRates.terrorismRate).toBeCloseTo(τ, 8);
  });

  it("session τ from Terrorism Levy edit applies on later True Base (with fold)", () => {
    const first = applyManualPremiumEdit({
      premium: premium({
        contractWorksBasePremium: 1250,
        contractWorksTerrorismPremium: 66.25,
        contractWorksExistingStructurePremium: 340,
        contractWorksDisplayHomesPremium: 10,
      }),
      rating: rating({ terrorismRate: 0.053 }),
      key: "contractWorksTerrorismPremium",
      value: 100,
    });

    const second = applyManualPremiumEdit({
      premium: first.premium,
      rating: rating({ terrorismRate: 0.053 }),
      key: "contractWorksBasePremium",
      value: 11250,
      sessionRates: first.sessionRates,
    });

    const τ = 100 / 1250;
    expect(second.premium.contractWorksTerrorismPremium).toBe(
      Math.round((11250 + 340 + 10) * τ * 100) / 100,
    );
  });

  it("Quirk 4 fixed: ESL edit does not freeze later True Base tax recalc", () => {
    const afterEsl = applyManualPremiumEdit({
      premium: premium({
        contractWorksBasePremium: 1250,
        contractWorksTerrorismPremium: 66.25,
      }),
      rating: rating({ terrorismRate: 0.053, eslRate: 0.27 }),
      key: "contractWorksESL",
      value: 99,
    });
    expect(afterEsl.premium.contractWorksESL).toBe(99);
    expect(afterEsl.manualTaxOverride).toBe(false);

    const afterBase = applyManualPremiumEdit({
      premium: afterEsl.premium,
      rating: rating({ terrorismRate: 0.053, eslRate: 0.27 }),
      key: "contractWorksBasePremium",
      value: 2000,
      sessionRates: afterEsl.sessionRates,
    });

    const terror = Math.round(2000 * 0.053 * 100) / 100;
    const expectedEsl = Math.round((2000 + terror) * 0.27 * 100) / 100;
    expect(afterBase.premium.contractWorksESL).toBe(expectedEsl);
    expect(afterBase.premium.contractWorksESL).not.toBe(99);
  });

  it("Plant edit: ESL uses prior plant terror, then plant terror = τ×plant", () => {
    const τ = 0.053;
    const plantEslRate = 0.27;
    const prevPlantTerror = 5;
    const plant = 100;

    const result = applyManualPremiumEdit({
      premium: premium({
        contractWorksBasePremium: 1250,
        contractWorksTerrorismPremium: Math.round(1250 * τ * 100) / 100,
        contractWorksPlantPremium: 50,
        contractWorksPlantTerrorismPremium: prevPlantTerror,
      }),
      rating: rating({ terrorismRate: τ, plantEslRate, eslRate: 0.2 }),
      key: "contractWorksPlantPremium",
      value: plant,
    });

    expect(result.premium.contractWorksPlantESL).toBe(
      Math.round((plant + prevPlantTerror) * plantEslRate * 100) / 100,
    );
    expect(result.premium.contractWorksPlantTerrorismPremium).toBe(
      Math.round(plant * τ * 100) / 100,
    );
  });

  it("typed Terrorism Levy Plant and Equipment sticks and recalculates Plant ESL", () => {
    const τ = 0.053;
    const plantEslRate = 0.27;
    const plant = 100;
    const editedPlantTerror = 8.5;
    const expectedPlantEsl = Math.round(
      (plant + editedPlantTerror) * plantEslRate * 100,
    ) / 100;

    const result = applyManualPremiumEdit({
      premium: premium({
        contractWorksBasePremium: 1250,
        contractWorksTerrorismPremium: Math.round(1250 * τ * 100) / 100,
        contractWorksPlantPremium: plant,
        contractWorksPlantTerrorismPremium: Math.round(plant * τ * 100) / 100,
        contractWorksPlantESL: Math.round(plant * plantEslRate * 100) / 100,
      }),
      rating: rating({ terrorismRate: τ, plantEslRate, eslRate: 0.2 }),
      key: "contractWorksPlantTerrorismPremium",
      value: editedPlantTerror,
    });

    expect(result.premium.contractWorksPlantTerrorismPremium).toBe(
      editedPlantTerror,
    );
    expect(result.premium.contractWorksPlantESL).toBe(expectedPlantEsl);
  });

  it("derives τ from folded levy when rating is missing", () => {
    const base = 1250;
    const es = 10;
    const τ = 0.053;
    // Stored levy already folded at previous es=0 → base×τ; editing es uses derived τ
    const result = applyManualPremiumEdit({
      premium: premium({
        contractWorksBasePremium: base,
        contractWorksTerrorismPremium: Math.round(base * τ * 100) / 100,
      }),
      rating: undefined,
      key: "contractWorksExistingStructurePremium",
      value: es,
    });

    expect(result.premium.contractWorksTerrorismPremium).toBe(
      Math.round((base + es) * τ * 100) / 100,
    );
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
    });

    expect(result.premium.liabilityBasePremium).toBe(base);
    expect(result.premium.liabilityGST).toBe(gst);
    expect(result.premium.liabilityStampDuty).toBe(sd);
  });
});
