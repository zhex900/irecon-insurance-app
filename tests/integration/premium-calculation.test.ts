import { beforeEach, describe, expect, it, vi } from "vitest";

import { calculatePremiumForPolicy } from "~/lib/services/price/premium.service";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

/**
 * Premium Calculation Integration Tests
 *
 * Tests the critical premium calculation service with different scenarios,
 * edge cases, and performance validations.
 */

// Mock external dependencies
const mockReferenceData = {
  states: [
    { stateId: 1, code: "NSW" },
    { stateId: 2, code: "VIC" },
    { stateId: 3, code: "QLD" },
  ],
};

vi.mock("~/lib/services/reference.service", () => ({
  getReferenceData: vi.fn(() => mockReferenceData),
}));

vi.mock("~/server/pricing/car-calculator", () => ({
  calculateCarPremium: vi.fn((input, stateCode, brokerFeeTotal) => ({
    contractWorksCalculatedBasePremium: input.estimatedTurnover * 0.001,
    contractWorksBasePremium: input.estimatedTurnover * 0.001,
    contractWorksTerrorismPremium: input.estimatedTurnover * 0.000053,
    contractWorksDisplayHomesPremium: input.displayHomes * 500,
    contractWorksExistingStructurePremium: input.existingStructure * 0.01,
    contractWorksPlantPremium: input.plantEquipment * 0.0015,
    contractWorksPlantTerrorismPremium: input.plantEquipment * 0.0000796,
    contractWorksPlantESL: input.plantEquipment * 0.000316,
    contractWorksESL: input.estimatedTurnover * 0.0002106,
    contractWorksGST: 0, // Calculated later
    contractWorksStampDuty: 0, // Calculated later
    contractWorksTotalPremium: 0, // Calculated later
    liabilityCalculatedBasePremium: 500,
    liabilityBasePremium: 500,
    liabilityESL: 0,
    liabilityGST: 0,
    liabilityStampDuty: 0,
    liabilityTotalPremium: 0,
    combinedBrokerFee: brokerFeeTotal,
    originalTotalPremium: 0,
  })),
}));

vi.mock("~/server/pricing/rate-resolver", () => ({
  resolveBrokerFeeTotal: vi.fn(() => Promise.resolve(100)),
}));

vi.mock("~/lib/performance/internal-monitoring.server", () => ({
  monitorCriticalOperation: vi.fn((_operation, fn) => fn()),
}));

describe("Premium Calculation Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to create test policy values
  function createTestPolicyValues(
    overrides: Partial<CarPolicyFormValues> = {},
  ): CarPolicyFormValues {
    return {
      coverTypeId: 1,
      annualCoverTypeId: null,
      siteAddress: "123 Test Street, Sydney NSW 2000",
      insuredName: "Test Construction Pty Ltd",
      estimatedTurnover: 1000000,
      businessActivities: "Construction",
      insuredContracts: "New construction",
      geographicalScopes: "NSW",
      plantEquipment: 50000,
      existingStructure: 0,
      displayHomes: 0,
      claimsCountLast3Years: 0,
      anyClaimsExceed20k: false,
      declarationConfirmed: true,
      contractWorksSumInsured: 3000000,
      liabilityLimitBand: 3,
      hasExistingContractWorksCover: false,
      currentInsurer: "None",
      maximumConstructionPeriod: 12,
      maximumMaintenancePeriod: 12,
      contractWorksExistingStructurePremium: 0,
      contractWorksDisplayHomesPremium: 0,
      dateStart: "2026-01-01",
      dateEnd: "2026-12-31",
      premiumBreakdown: "",
      stateId: 1,
      postcode: "2000",
      ...overrides,
    };
  }

  describe("basic premium calculation", () => {
    it("calculates premium for standard construction policy", async () => {
      // Arrange
      const policyValues = createTestPolicyValues({
        estimatedTurnover: 1000000,
        plantEquipment: 50000,
        contractWorksSumInsured: 3000000,
      });

      // Act
      const result = await calculatePremiumForPolicy(policyValues);

      // Assert
      expect(result).toBeDefined();
      expect(result).toHaveProperty("contractWorksCalculatedBasePremium");
      expect(result).toHaveProperty("liabilityCalculatedBasePremium");
      expect(result).toHaveProperty("combinedBrokerFee");

      // Basic validation of calculated values
      expect(result.contractWorksCalculatedBasePremium).toBeGreaterThan(0);
      expect(result.liabilityCalculatedBasePremium).toBe(500); // Mocked base
      expect(result.combinedBrokerFee).toBe(100); // Mocked broker fee
    });

    it("calculates different premiums for different turnover values", async () => {
      // Arrange
      const basePolicy = createTestPolicyValues({ estimatedTurnover: 1000000 });
      const highTurnoverPolicy = createTestPolicyValues({
        estimatedTurnover: 2000000,
      });

      // Act
      const baseResult = await calculatePremiumForPolicy(basePolicy);
      const highResult = await calculatePremiumForPolicy(highTurnoverPolicy);

      // Assert
      expect(highResult.contractWorksCalculatedBasePremium).toBeGreaterThan(
        baseResult.contractWorksCalculatedBasePremium,
      );

      // Terrorism premium should also be higher
      expect(highResult.contractWorksTerrorismPremium).toBeGreaterThan(
        baseResult.contractWorksTerrorismPremium,
      );
    });

    it("includes plant equipment in premium calculation", async () => {
      // Arrange
      const noEquipmentPolicy = createTestPolicyValues({ plantEquipment: 0 });
      const withEquipmentPolicy = createTestPolicyValues({
        plantEquipment: 100000,
      });

      // Act
      const noEquipmentResult =
        await calculatePremiumForPolicy(noEquipmentPolicy);
      const withEquipmentResult =
        await calculatePremiumForPolicy(withEquipmentPolicy);

      // Assert
      expect(withEquipmentResult.contractWorksPlantPremium).toBeGreaterThan(
        noEquipmentResult.contractWorksPlantPremium,
      );

      expect(
        withEquipmentResult.contractWorksPlantTerrorismPremium,
      ).toBeGreaterThan(noEquipmentResult.contractWorksPlantTerrorismPremium);
    });

    it("handles display homes premium correctly", async () => {
      // Arrange
      const noDisplayHomesPolicy = createTestPolicyValues({ displayHomes: 0 });
      const withDisplayHomesPolicy = createTestPolicyValues({
        displayHomes: 2,
      });

      // Act
      const noDisplayResult =
        await calculatePremiumForPolicy(noDisplayHomesPolicy);
      const withDisplayResult = await calculatePremiumForPolicy(
        withDisplayHomesPolicy,
      );

      // Assert
      expect(
        withDisplayResult.contractWorksDisplayHomesPremium,
      ).toBeGreaterThan(noDisplayResult.contractWorksDisplayHomesPremium);
    });
  });

  describe("edge cases and validation", () => {
    it("handles zero turnover correctly", async () => {
      // Arrange
      const zeroTurnoverPolicy = createTestPolicyValues({
        estimatedTurnover: 0,
      });

      // Act
      const result = await calculatePremiumForPolicy(zeroTurnoverPolicy);

      // Assert
      expect(result).toBeDefined();
      expect(result.contractWorksCalculatedBasePremium).toBe(0);
      expect(result.contractWorksTerrorismPremium).toBe(0);
      expect(result.contractWorksESL).toBe(0);
    });

    it("handles very high values correctly", async () => {
      // Arrange
      const largePolicy = createTestPolicyValues({
        estimatedTurnover: 10000000, // $10M
        plantEquipment: 1000000, // $1M
        contractWorksSumInsured: 50000000, // $50M
      });

      // Act
      const result = await calculatePremiumForPolicy(largePolicy);

      // Assert
      expect(result).toBeDefined();
      expect(result.contractWorksCalculatedBasePremium).toBeGreaterThan(0);
      expect(result.contractWorksPlantPremium).toBeGreaterThan(0);
    });

    it("validates required fields presence", async () => {
      // Arrange - create policy with missing required field
      const incompletePolicy = createTestPolicyValues();
      // @ts-expect-error - Testing invalid input
      delete incompletePolicy.estimatedTurnover;

      // Act & Assert
      // Note: The actual validation might happen in the car calculator
      // This test ensures the service doesn't crash on invalid input
      await expect(
        calculatePremiumForPolicy(
          incompletePolicy as Partial<CarPolicyFormValues>,
        ),
      ).rejects.toThrow();
    });

    it("handles different state codes correctly", async () => {
      // Arrange
      const nswPolicy = createTestPolicyValues({ stateId: 1 }); // NSW
      const vicPolicy = createTestPolicyValues({ stateId: 2 }); // VIC
      const qldPolicy = createTestPolicyValues({ stateId: 3 }); // QLD

      // Act
      const nswResult = await calculatePremiumForPolicy(nswPolicy);
      const vicResult = await calculatePremiumForPolicy(vicPolicy);
      const qldResult = await calculatePremiumForPolicy(qldPolicy);

      // Assert
      // All should calculate successfully
      expect(nswResult).toBeDefined();
      expect(vicResult).toBeDefined();
      expect(qldResult).toBeDefined();

      // Mock returns same values, but real implementation might differ by state
      // This test ensures the function handles different state codes
    });
  });

  describe("performance and monitoring", () => {
    it("monitors critical operation", async () => {
      // Arrange
      const policyValues = createTestPolicyValues();

      // Act
      await calculatePremiumForPolicy(policyValues);

      // Assert
      const { monitorCriticalOperation } =
        await import("~/lib/performance/internal-monitoring.server");
      expect(monitorCriticalOperation).toHaveBeenCalledWith(
        "premiumCalculation",
        expect.any(Function),
      );
    });

    it("calculates premium within performance limits", async () => {
      // Arrange
      const policyValues = createTestPolicyValues();
      const startTime = performance.now();

      // Act
      await calculatePremiumForPolicy(policyValues);
      const endTime = performance.now();
      const calculationTime = endTime - startTime;

      // Assert
      // Premium calculation should be very fast
      expect(calculationTime).toBeLessThan(1000); // < 1 second
    });

    it("handles concurrent calculations correctly", async () => {
      // Arrange
      const policies = [
        createTestPolicyValues({ estimatedTurnover: 500000 }),
        createTestPolicyValues({ estimatedTurnover: 1000000 }),
        createTestPolicyValues({ estimatedTurnover: 1500000 }),
      ];

      // Act - run concurrently
      const startTime = performance.now();
      const results = await Promise.all(
        policies.map((policy) => calculatePremiumForPolicy(policy)),
      );
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].contractWorksCalculatedBasePremium).toBeLessThan(
        results[1].contractWorksCalculatedBasePremium,
      );
      expect(results[1].contractWorksCalculatedBasePremium).toBeLessThan(
        results[2].contractWorksCalculatedBasePremium,
      );

      // Concurrent calculations should be efficient
      expect(totalTime).toBeLessThan(2000); // < 2 seconds for all 3
    });
  });

  describe("broker fee integration", () => {
    it("includes broker fee in premium calculation", async () => {
      // Arrange
      const policyValues = createTestPolicyValues();

      // Act
      const result = await calculatePremiumForPolicy(policyValues);

      // Assert
      expect(result).toHaveProperty("combinedBrokerFee");
      expect(result.combinedBrokerFee).toBe(100); // From mock
    });

    it("fetches broker fee based on date", async () => {
      // Arrange
      const policyValues = createTestPolicyValues({
        dateStart: "2026-06-01",
      });

      // Act
      await calculatePremiumForPolicy(policyValues);

      // Assert
      const { resolveBrokerFeeTotal } =
        await import("~/server/pricing/rate-resolver");
      expect(resolveBrokerFeeTotal).toHaveBeenCalledWith("2026-06-01");
    });
  });

  describe("referral notes integration", () => {
    it("handles claims history referrals", async () => {
      // Arrange
      const policyWithClaims = createTestPolicyValues({
        claimsCountLast3Years: 3,
        anyClaimsExceed20k: true,
      });

      // Act
      const result = await calculatePremiumForPolicy(policyWithClaims);

      // Assert
      expect(result).toBeDefined();
      // Premium should still calculate even with claims history
      expect(result.contractWorksCalculatedBasePremium).toBeGreaterThan(0);
    });

    it("handles high risk activities", async () => {
      // Arrange
      const highRiskPolicy = createTestPolicyValues({
        businessActivities: "Demolition",
        insuredContracts: "Hazardous material removal",
      });

      // Act
      const result = await calculatePremiumForPolicy(highRiskPolicy);

      // Assert
      expect(result).toBeDefined();
      // High risk activities should still produce a premium calculation
      expect(result.contractWorksCalculatedBasePremium).toBeGreaterThan(0);
    });
  });
});
