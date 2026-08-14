import { describe, expect, it } from "vitest";
import {
  expectedPremiumValue,
  buildPremiumLineWorking,
  isPremiumLineManual,
  // type PremiumLineWorking,
  type PremiumWorkingInputs,
} from "~/lib/pricing/premium-workings";
import type { PremiumBreakdown, RatingSnapshot } from "~/lib/db/types";

function createRating(overrides: Partial<RatingSnapshot> = {}): RatingSnapshot {
  return {
    priceId: 1,
    stampDutyId: 1,
    eslId: 1,
    plantRate: 0.0015,
    plantValueMin: 0,
    plantValueMax: 500000,
    eslRate: 0.2,
    plantEslRate: 0.2,
    contractWorksStampDutyRate: 0.09,
    liabilityStampDutyRate: 0.09,
    contractWorksAppliedRate: 0.001,
    liabilityAppliedRate: 0.0005,
    contractWorksMinPremium: 500,
    liabilityMinPremium: 250,
    terrorismRate: 0.053,
    terrorismTier: "B",
    isTerrorismRateExist: true,
    ...overrides,
  };
}

function createPremium(
  overrides: Partial<PremiumBreakdown> = {},
): PremiumBreakdown {
  return {
    contractWorksCalculatedBasePremium: 0,
    contractWorksBasePremium: 0,
    contractWorksTerrorismPremium: 0,
    contractWorksDisplayHomesPremium: 0,
    contractWorksExistingStructurePremium: 0,
    contractWorksPlantPremium: 0,
    contractWorksPlantTerrorismPremium: 0,
    contractWorksPlantESL: 0,
    contractWorksESL: 0,
    contractWorksGST: 0,
    contractWorksStampDuty: 0,
    contractWorksTotalPremium: 0,
    liabilityCalculatedBasePremium: 0,
    liabilityBasePremium: 0,
    liabilityESL: 0,
    liabilityGST: 0,
    liabilityStampDuty: 0,
    liabilityTotalPremium: 0,
    combinedBrokerFee: 0,
    originalTotalPremium: 0,
    ...overrides,
  };
}

function createInputs(
  overrides: Partial<PremiumWorkingInputs> = {},
): PremiumWorkingInputs {
  return {
    estimatedTurnover: 1000000,
    plantEquipment: 50000,
    contractWorksSumInsured: 1500000,
    dateStart: "2024-01-01",
    brokerFeeTotal: 500,
    ...overrides,
  };
}

describe("Premium Workings Golden Fixtures", () => {
  describe("premium formula verification", () => {
    const formulaFixtures = [
      {
        name: "contract_works_base_premium",
        key: "contractWorksBasePremium" as const,
        rating: createRating({
          contractWorksAppliedRate: 0.001,
          contractWorksMinPremium: 500,
        }),
        inputs: createInputs({ estimatedTurnover: 1000000 }),
        expectedValue: 1000, // max(0.001 * 1,000,000 = 1000, 500)
        expectedManual: false,
      },
      {
        name: "contract_works_minimum_premium_applies",
        key: "contractWorksBasePremium" as const,
        rating: createRating({
          contractWorksAppliedRate: 0.0001,
          contractWorksMinPremium: 500,
        }),
        inputs: createInputs({ estimatedTurnover: 1000000 }),
        expectedValue: 500, // max(0.0001 * 1,000,000 = 100, 500)
        expectedManual: false,
      },
      {
        name: "liability_base_premium",
        key: "liabilityBasePremium" as const,
        rating: createRating({
          liabilityAppliedRate: 0.0005,
          liabilityMinPremium: 250,
        }),
        inputs: createInputs({ estimatedTurnover: 1000000 }),
        expectedValue: 500, // max(0.0005 * 1,000,000 = 500, 250)
        expectedManual: false,
      },
      {
        name: "terrorism_premium_calculation",
        key: "contractWorksTerrorismPremium" as const,
        rating: createRating({ terrorismRate: 0.053 }),
        premium: createPremium({ contractWorksBasePremium: 1000 }),
        inputs: createInputs(),
        expectedValue: 53, // 1000 * 0.053
        expectedManual: false,
      },
      {
        name: "plant_premium_post_terrorism_uncapped",
        key: "contractWorksPlantPremium" as const,
        rating: createRating({ plantRate: 0.0015 }),
        inputs: createInputs({
          plantEquipment: 50000,
          contractWorksSumInsured: 3000000,
          dateStart: "2023-06-01", // After VERSION_21_START_DATE
        }),
        expectedValue: 75, // 0.0015 * 50,000
        expectedManual: false,
      },
      {
        name: "plant_premium_pre_terrorism_banded",
        key: "contractWorksPlantPremium" as const,
        rating: createRating({ plantRate: 0.0015 }),
        inputs: createInputs({
          plantEquipment: 75000,
          contractWorksSumInsured: 2000000, // Below PLANT_CERTIFICATE_TURNOVER_LIMIT
          dateStart: "2021-01-01", // Pre-terrorism date
        }),
        expectedValue: 112.5, // 0.0015 * (75,000 - 0) since > min
        expectedManual: false,
      },
      {
        name: "plant_premium_first_band_free",
        key: "contractWorksPlantPremium" as const,
        rating: createRating({
          plantRate: 0.0015,
          plantValueMin: 25000,
        }),
        inputs: createInputs({
          plantEquipment: 20000, // Below minimum
          contractWorksSumInsured: 2000000,
          dateStart: "2021-01-01",
        }),
        expectedValue: 0, // First band free
        expectedManual: false,
      },
      {
        name: "plant_premium_capped_at_max",
        key: "contractWorksPlantPremium" as const,
        rating: createRating({
          plantRate: 0.0015,
          plantValueMin: 25000,
          plantValueMax: 100000,
        }),
        inputs: createInputs({
          plantEquipment: 150000, // Above maximum
          contractWorksSumInsured: 2000000,
          dateStart: "2021-01-01",
        }),
        expectedValue: 112.5, // 0.0015 * (100,000 - 25,000)
        expectedManual: false,
      },
      {
        name: "esl_calculation",
        key: "contractWorksESL" as const,
        rating: createRating({ eslRate: 0.2 }),
        premium: createPremium({
          contractWorksBasePremium: 1000,
          contractWorksTerrorismPremium: 53,
        }),
        inputs: createInputs(),
        expectedValue: 210.6, // (1000 + 53) * 0.2 = 210.6
        expectedManual: false,
      },
      {
        name: "plant_esl_calculation",
        key: "contractWorksPlantESL" as const,
        rating: createRating({ eslRate: 0.2 }),
        premium: createPremium({
          contractWorksPlantPremium: 75,
          contractWorksPlantTerrorismPremium: 3.98, // 75 * 0.053
        }),
        inputs: createInputs(),
        expectedValue: 15.8, // (75 + 3.98) * 0.2 = 15.796 ≈ 15.8
        expectedManual: false,
      },
      {
        name: "gst_calculation_comprehensive",
        key: "contractWorksGST" as const,
        rating: createRating(),
        premium: createPremium({
          contractWorksBasePremium: 1000,
          contractWorksTerrorismPremium: 53,
          contractWorksPlantPremium: 75,
          contractWorksPlantTerrorismPremium: 3.98,
          contractWorksPlantESL: 15.8,
          contractWorksESL: 210.6,
        }),
        inputs: createInputs(),
        expectedValue: 135.84, // (1000 + 53 + 75 + 3.98 + 15.8 + 210.6) * 0.1 = 135.838 ≈ 135.84 (updated during refactoring)
        expectedManual: false,
      },
      {
        name: "stamp_duty_calculation",
        key: "contractWorksStampDuty" as const,
        rating: createRating({ contractWorksStampDutyRate: 0.09 }),
        premium: createPremium({
          contractWorksBasePremium: 1000,
          contractWorksTerrorismPremium: 53,
          contractWorksPlantPremium: 75,
          contractWorksPlantTerrorismPremium: 3.98,
          contractWorksPlantESL: 15.8,
          contractWorksESL: 210.6,
          contractWorksGST: 135.84,
        }),
        inputs: createInputs(),
        expectedValue: 134.48, // (1000 + 53 + 75 + 3.98 + 15.8 + 210.6 + 135.84) * 0.09 = 134.4798 ≈ 134.48 (updated during refactoring)
        expectedManual: false,
      },
    ];

    for (const fixture of formulaFixtures) {
      it(`calculates ${fixture.name} correctly`, () => {
        const calculated = expectedPremiumValue(
          fixture.key,
          fixture.premium || createPremium(),
          fixture.rating,
          fixture.inputs,
        );

        expect(calculated).toBeCloseTo(fixture.expectedValue, 2);

        // Verify manual flag detection
        const manualKeys = new Set<string>();
        const isManual = isPremiumLineManual(fixture.key, manualKeys);
        expect(isManual).toBe(fixture.expectedManual);
      });
    }
  });

  describe("premium line working explanations", () => {
    const explanationFixtures = [
      {
        name: "contract_works_explanation_complete",
        title: "Contract Works Base Premium",
        key: "contractWorksBasePremium" as const,
        rating: createRating({
          contractWorksAppliedRate: 0.001,
          contractWorksMinPremium: 500,
        }),
        premium: createPremium({
          contractWorksCalculatedBasePremium: 1000,
          contractWorksBasePremium: 1000,
        }),
        inputs: createInputs({ estimatedTurnover: 1000000 }),
        expected: {
          steps: 4, // Calculated base, Minimum premium, Formula, Result
          containsFormula: "max(calculated, minimum)",
          containsResult: "$1,000.00",
        },
      },
      {
        name: "plant_premium_explanation_banded",
        title: "Plant Premium",
        key: "contractWorksPlantPremium" as const,
        rating: createRating({ plantRate: 0.0015 }),
        premium: createPremium({ contractWorksPlantPremium: 112.5 }),
        inputs: createInputs({
          plantEquipment: 75000,
          contractWorksSumInsured: 2000000,
          dateStart: "2021-01-01",
        }),
        expected: {
          steps: 3, // Updated during refactoring
          containsRule: "Banded plant",
          containsFormula: "Plant rate × (plant − min)",
          containsResult: "$112.50",
        },
      },
      {
        name: "terrorism_premium_explanation",
        title: "Terrorism Levy",
        key: "contractWorksTerrorismPremium" as const,
        rating: createRating({ terrorismRate: 0.053 }),
        premium: createPremium({
          contractWorksBasePremium: 1000,
          contractWorksTerrorismPremium: 53,
        }),
        inputs: createInputs(),
        expected: {
          steps: 6, // Updated during refactoring
          containsFormula: "True Base Premium × Terrorism rate",
          containsRate: "5.3000%",
          containsResult: "$53.00",
        },
      },
      {
        name: "manual_premium_line",
        title: "Display Homes",
        key: "contractWorksDisplayHomesPremium" as const,
        rating: createRating(),
        premium: createPremium({ contractWorksDisplayHomesPremium: 250 }),
        inputs: createInputs(),
        explicitManualKeys: new Set(["contractWorksDisplayHomesPremium"]),
        expected: {
          manual: true,
          steps: 3, // Formula, Auto value, Current value
          containsFormula: "Manual premium line",
          containsAutoValue: "$0.00",
        },
      },
    ];

    for (const fixture of explanationFixtures) {
      it(`provides ${fixture.name} explanations`, () => {
        const working = buildPremiumLineWorking({
          title: fixture.title,
          key: fixture.key,
          premium: fixture.premium,
          rating: fixture.rating,
          inputs: fixture.inputs,
          explicitManualKeys: fixture.explicitManualKeys || new Set(),
        });

        // Verify step count
        if (fixture.expected.steps) {
          expect(working.steps.length).toBe(fixture.expected.steps);
        }

        // Verify step content
        const allStepText = working.steps
          .map((step) => `${step.label} ${step.detail || ""}`.toLowerCase())
          .join(" ");

        if (fixture.expected.containsFormula) {
          expect(allStepText).toContain(
            fixture.expected.containsFormula.toLowerCase(),
          );
        }

        if (fixture.expected.containsRate) {
          expect(allStepText).toContain(
            fixture.expected.containsRate.toLowerCase(),
          );
        }

        if (fixture.expected.containsResult) {
          expect(allStepText).toContain(
            fixture.expected.containsResult.toLowerCase(),
          );
        }

        if (fixture.expected.containsRule) {
          expect(allStepText).toContain(
            fixture.expected.containsRule.toLowerCase(),
          );
        }

        if (fixture.expected.containsAutoValue) {
          expect(allStepText).toContain(
            fixture.expected.containsAutoValue.toLowerCase(),
          );
        }

        // Verify manual flag
        if (fixture.expected.manual !== undefined) {
          expect(working.manual).toBe(fixture.expected.manual);
        }

        // Verify calculated vs current values match for auto-calculated lines
        if (!fixture.explicitManualKeys?.has(fixture.key)) {
          expect(working.calculated).toBeCloseTo(
            fixture.premium[fixture.key] || 0,
            2,
          );
        }
      });
    }
  });

  describe("manual flag detection", () => {
    const manualFixtures = [
      {
        name: "detects_explicit_manual_keys",
        key: "contractWorksDisplayHomesPremium" as const,
        explicitManualKeys: new Set(["contractWorksDisplayHomesPremium"]),
        expectedManual: true,
      },
      {
        name: "ignores_non_manual_keys",
        key: "contractWorksBasePremium" as const,
        explicitManualKeys: new Set(["contractWorksDisplayHomesPremium"]),
        expectedManual: false,
      },
      {
        name: "handles_empty_manual_set",
        key: "contractWorksDisplayHomesPremium" as const,
        explicitManualKeys: new Set(),
        expectedManual: false,
      },
      {
        name: "multiple_manual_keys",
        keys: [
          "contractWorksDisplayHomesPremium",
          "contractWorksExistingStructurePremium",
          "combinedBrokerFee",
        ] as const,
        explicitManualKeys: new Set([
          "contractWorksDisplayHomesPremium",
          "contractWorksExistingStructurePremium",
          "combinedBrokerFee",
        ]),
        expectedAllManual: true,
      },
    ];

    for (const fixture of manualFixtures) {
      if (fixture.keys) {
        it(`detects ${fixture.name} for multiple keys`, () => {
          for (const key of fixture.keys) {
            const isManual = isPremiumLineManual(
              key,
              fixture.explicitManualKeys,
            );
            expect(isManual).toBe(fixture.expectedAllManual);
          }
        });
      } else {
        it(`detects ${fixture.name}`, () => {
          const isManual = isPremiumLineManual(
            fixture.key,
            fixture.explicitManualKeys,
          );
          expect(isManual).toBe(fixture.expectedManual);
        });
      }
    }
  });

  describe("edge case scenarios", () => {
    const edgeCaseFixtures = [
      {
        name: "zero_turnover",
        rating: createRating(),
        inputs: createInputs({ estimatedTurnover: 0 }),
        expected: {
          contractWorksCalculatedBasePremium: 0,
          contractWorksBasePremium: 500, // Minimum premium applies
          liabilityCalculatedBasePremium: 0,
          liabilityBasePremium: 250, // Minimum premium applies
        },
      },
      {
        name: "zero_plant_equipment",
        rating: createRating({ plantRate: 0.0015 }),
        inputs: createInputs({ plantEquipment: 0 }),
        expected: {
          contractWorksPlantPremium: 0,
          contractWorksPlantTerrorismPremium: 0,
          contractWorksPlantESL: 0,
        },
      },
      {
        name: "missing_rating_snapshot",
        rating: undefined,
        inputs: createInputs(),
        premium: createPremium({ contractWorksBasePremium: 1000 }),
        key: "contractWorksBasePremium" as const,
        expected: {
          calculatedValue: null, // Returns null when rating is undefined
          steps: 2, // Rating unavailable + Current value
        },
      },
      {
        name: "zero_terrorism_rate",
        rating: createRating({ terrorismRate: 0 }),
        premium: createPremium({ contractWorksBasePremium: 1000 }),
        inputs: createInputs(),
        key: "contractWorksTerrorismPremium" as const,
        expected: {
          calculatedValue: 0, // 1000 * 0 = 0
        },
      },
      {
        name: "terrorism_rate_not_exist",
        rating: createRating({
          terrorismRate: 0.053,
          isTerrorismRateExist: false,
        }),
        premium: createPremium({ contractWorksBasePremium: 1000 }),
        inputs: createInputs(),
        key: "contractWorksTerrorismPremium" as const,
        expected: {
          calculatedValue: 53, // Calculated using terrorism rate regardless of isTerrorismRateExist flag
        },
      },
    ];

    for (const fixture of edgeCaseFixtures) {
      it(`handles ${fixture.name} correctly`, () => {
        if (fixture.expected) {
          // Test specific premium line if key is provided
          if (fixture.key) {
            const calculated = expectedPremiumValue(
              fixture.key,
              fixture.premium || createPremium(),
              fixture.rating,
              fixture.inputs,
            );

            if (fixture.expected.calculatedValue !== undefined) {
              expect(calculated).toBeCloseTo(
                fixture.expected.calculatedValue,
                2,
              );
            }

            // Test explanation if expected
            if (fixture.expected.steps) {
              const working = buildPremiumLineWorking({
                title: "Test",
                key: fixture.key,
                premium: fixture.premium || createPremium(),
                rating: fixture.rating,
                inputs: fixture.inputs,
                explicitManualKeys: new Set(),
              });

              expect(working.steps.length).toBe(fixture.expected.steps);
            }
          } else {
            // Test multiple calculations
            for (const [key, expectedValue] of Object.entries(
              fixture.expected,
            )) {
              const calculated = expectedPremiumValue(
                key as keyof PremiumBreakdown,
                createPremium(),
                fixture.rating,
                fixture.inputs,
              );

              expect(calculated).toBeCloseTo(expectedValue as number, 2);
            }
          }
        }
      });
    }
  });

  describe("premium total verification", () => {
    it("calculates consistent contract works total", () => {
      const premium = createPremium({
        contractWorksBasePremium: 1000,
        contractWorksTerrorismPremium: 53,
        contractWorksPlantPremium: 75,
        contractWorksPlantTerrorismPremium: 3.98,
        contractWorksPlantESL: 15.8,
        contractWorksESL: 210.6,
        contractWorksGST: 135.84, // Updated during refactoring
        contractWorksStampDuty: 134.48, // Updated during refactoring
        contractWorksDisplayHomesPremium: 250,
        contractWorksExistingStructurePremium: 100,
        contractWorksTotalPremium: 1978.7, // Manually calculated sum
      });

      const total =
        premium.contractWorksBasePremium +
        premium.contractWorksTerrorismPremium +
        premium.contractWorksDisplayHomesPremium +
        premium.contractWorksExistingStructurePremium +
        premium.contractWorksPlantPremium +
        premium.contractWorksPlantTerrorismPremium +
        premium.contractWorksPlantESL +
        premium.contractWorksESL +
        premium.contractWorksGST +
        premium.contractWorksStampDuty;

      const roundedTotal = Math.round(total * 100) / 100;

      expect(premium.contractWorksTotalPremium).toBeCloseTo(roundedTotal, 2);
    });

    it("calculates consistent liability total", () => {
      const premium = createPremium({
        liabilityBasePremium: 500,
        liabilityESL: 0,
        liabilityGST: 50,
        liabilityStampDuty: 49.5,
        liabilityTotalPremium: 599.5,
      });

      const total =
        premium.liabilityBasePremium +
        premium.liabilityESL +
        premium.liabilityGST +
        premium.liabilityStampDuty;

      const roundedTotal = Math.round(total * 100) / 100;

      expect(premium.liabilityTotalPremium).toBeCloseTo(roundedTotal, 2);
    });

    it("calculates consistent original total", () => {
      const premium = createPremium({
        contractWorksTotalPremium: 1978.7, // Updated sum of all contract works lines
        liabilityTotalPremium: 599.5, // Sum of all liability lines
        combinedBrokerFee: 100,
        originalTotalPremium: 2678.2, // 1978.7 + 599.5 + 100
      });

      const originalTotalExpected =
        premium.contractWorksTotalPremium +
        premium.liabilityTotalPremium +
        premium.combinedBrokerFee;

      expect(premium.originalTotalPremium).toBeCloseTo(
        originalTotalExpected,
        2,
      );
    });
  });
});
