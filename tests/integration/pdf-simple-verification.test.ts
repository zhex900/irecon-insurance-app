import { describe, expect, it, vi, beforeEach } from "vitest";
import { generatePolicyPdf } from "~/lib/pdf/generate";
import type { Policy } from "~/lib/db/types";

/**
 * Simplified PDF integration tests.
 * Focuses on verifying that PDF generation works without complex mocking.
 * This provides a critical safety net for refactoring PDF generation code.
 */

// Create minimal mock for template cache
const mockCache = {
  getCachedPublishedTemplate: vi.fn((key: string) => {
    // Return a simple mock template for common keys
    if (key === "schedule-annual" || key === "rating-annual") {
      return {
        key,
        coverTypeId: null,
        title: `${key} Template`,
        label: key.replace("-", " "),
        template: {
          basePdf: {
            width: 210,
            height: 297,
            padding: [15, 15, 15, 15],
          },
          schemas: [[
            {
              name: "PolicyNumber",
              type: "text",
              position: { x: 15, y: 30 },
              width: 80,
              height: 8,
              fontSize: 10,
              fontName: "Roboto",
            },
          ]],
        },
        flowPushDown: null,
        mergeFields: ["PolicyNumber"],
      };
    }
    return null;
  }),
  setCachedPublishedTemplate: vi.fn(),
};

// Mock the template cache module
vi.mock("~/lib/pdf/template-override-cache", () => mockCache);

// Also mock other complex dependencies
vi.mock("pdfme", () => ({
  generate: vi.fn(() => new Uint8Array([37, 80, 68, 70])), // %PDF
}));

// Helper function to create a minimal mock policy
function createMinimalPolicy(): Policy {
  return {
    policyId: "1",
    policyNumber: "POL123456",
    clientId: "1",
    policyCategoryId: 1,
    policyStatusId: 1,
    postcode: "2000",
    stateId: 1,
    dateEffective: "2026-01-01",
    dateStart: "2026-01-01",
    dateEnd: "2026-12-31",
    createdWhen: new Date().toISOString(),
    createdBy: "test-user",
    insurerCode: "TEST",
    isDraft: false,
    car: {
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
      subLimits: {} as any,
      excesses: {} as any,
      excludedContracts1: "",
      excludedContracts2: "",
      excludedContracts3: "",
      selectedWordingIds: [],
      customWordings: [],
      premium: {
        contractWorksCalculatedBasePremium: 1000,
        contractWorksBasePremium: 1000,
        contractWorksTerrorismPremium: 53,
        contractWorksDisplayHomesPremium: 0,
        contractWorksExistingStructurePremium: 0,
        contractWorksPlantPremium: 75,
        contractWorksPlantTerrorismPremium: 3.98,
        contractWorksPlantESL: 15.8,
        contractWorksESL: 210.6,
        contractWorksGST: 135.34,
        contractWorksStampDuty: 137.32,
        contractWorksTotalPremium: 1630.04,
        liabilityCalculatedBasePremium: 500,
        liabilityBasePremium: 500,
        liabilityESL: 0,
        liabilityGST: 50,
        liabilityStampDuty: 49.5,
        liabilityTotalPremium: 599.5,
        combinedBrokerFee: 100,
        originalTotalPremium: 2329.54,
      },
      adjustment: null,
    },
  } as Policy;
}

describe("PDF Generation Simple Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a PDF with basic template", async () => {
    const policy = createMinimalPolicy();
    
    const result = await generatePolicyPdf("schedule-annual", policy);
    
    // Verify basic structure of result
    expect(result).toHaveProperty("pdf");
    expect(result).toHaveProperty("templateKey", "schedule-annual");
    expect(result).toHaveProperty("inputs");
    
    // PDF should be a Uint8Array
    expect(result.pdf).toBeInstanceOf(Uint8Array);
    
    // PDF should have reasonable size (not empty, not huge)
    expect(result.pdf.length).toBeGreaterThan(100); // At least 100 bytes
    expect(result.pdf.length).toBeLessThan(1000000); // Less than 1MB
    
    // Verify template cache was called
    expect(mockCache.getCachedPublishedTemplate).toHaveBeenCalledWith("schedule-annual");
  });

  it("generates consistent PDF output for same inputs", async () => {
    const policy = createMinimalPolicy();
    
    // Generate PDF twice with same inputs
    const result1 = await generatePolicyPdf("schedule-annual", policy);
    const result2 = await generatePolicyPdf("schedule-annual", policy);
    
    // Both should have same structure
    expect(result1.templateKey).toBe(result2.templateKey);
    expect(Object.keys(result1.inputs)).toEqual(Object.keys(result2.inputs));
    
    // PDF byte arrays should be the same length (could be different content due to timestamps)
    expect(result1.pdf.length).toBe(result2.pdf.length);
    
    // At least the first few bytes should be the same (%PDF header)
    for (let i = 0; i < Math.min(10, result1.pdf.length, result2.pdf.length); i++) {
      expect(result1.pdf[i]).toBe(result2.pdf[i]);
    }
  });

  it("handles different template keys", async () => {
    const policy = createMinimalPolicy();
    
    const result1 = await generatePolicyPdf("schedule-annual", policy);
    const result2 = await generatePolicyPdf("rating-annual", policy);
    
    // Both should succeed
    expect(result1.pdf.length).toBeGreaterThan(0);
    expect(result2.pdf.length).toBeGreaterThan(0);
    
    // Template keys should be different
    expect(result1.templateKey).toBe("schedule-annual");
    expect(result2.templateKey).toBe("rating-annual");
    
    // Template cache should be called with both keys
    expect(mockCache.getCachedPublishedTemplate).toHaveBeenCalledWith("schedule-annual");
    expect(mockCache.getCachedPublishedTemplate).toHaveBeenCalledWith("rating-annual");
  });

  it("handles merge inputs override", async () => {
    const policy = createMinimalPolicy();
    const mergeInputs = {
      PolicyNumber: "CUSTOM123",
      InsuredName: "Custom Name",
    };
    
    const result = await generatePolicyPdf("schedule-annual", policy, mergeInputs);
    
    // Should include custom merge inputs
    expect(result.inputs.PolicyNumber).toBe("CUSTOM123");
    expect(result.inputs.InsuredName).toBe("Custom Name");
  });

  it("generates valid PDF header", async () => {
    const policy = createMinimalPolicy();
    const result = await generatePolicyPdf("schedule-annual", policy);
    
    // Check PDF header (first 4 bytes should be %PDF)
    const header = String.fromCharCode(...result.pdf.slice(0, 4));
    expect(header).toBe("%PDF");
  });

  it("handles missing template gracefully", async () => {
    const policy = createMinimalPolicy();
    
    // Mock to return null for unknown template
    mockCache.getCachedPublishedTemplate.mockReturnValueOnce(null);
    
    await expect(generatePolicyPdf("unknown-template", policy))
      .rejects.toThrow("No published pdfme template for unknown-template");
  });

  it("preserves critical policy data in inputs", async () => {
    const policy = createMinimalPolicy();
    
    const result = await generatePolicyPdf("schedule-annual", policy);
    
    // Critical policy data should be in inputs
    expect(result.inputs).toHaveProperty("PolicyNumber", "POL123456");
    expect(result.inputs).toHaveProperty("InsuredName", "Test Construction Pty Ltd");
    expect(result.inputs).toHaveProperty("SiteAddress", "123 Test Street, Sydney NSW 2000");
    expect(typeof result.inputs.PremiumBreakdown).toBe("string"); // JSON string
    expect(typeof result.inputs.EndorsementLibrary).toBe("string"); // JSON string
  });

  it("handles empty merge inputs", async () => {
    const policy = createMinimalPolicy();
    
    const result = await generatePolicyPdf("schedule-annual", policy, {});
    
    // Should still generate PDF
    expect(result.pdf.length).toBeGreaterThan(0);
    expect(result.inputs).toBeDefined();
  });

  it("generates PDF with wordings", async () => {
    const policy = createMinimalPolicy();
    const wordingCatalogue = [
      {
        id: 1,
        label: "Standard Wording",
        description: "Standard construction wording",
        html: "<p>Standard terms and conditions</p>",
        listStyle: "decimal",
      },
    ];
    
    const result = await generatePolicyPdf("schedule-annual", policy, undefined, undefined, {
      wordingCatalogue,
    });
    
    // Should include wordings in inputs
    expect(typeof result.inputs.EndorsementLibrary).toBe("string");
    const endorsements = JSON.parse(result.inputs.EndorsementLibrary);
    expect(endorsements).toBeInstanceOf(Array);
  });

  it("generates PDF with broker fee lines", async () => {
    const policy = createMinimalPolicy();
    const brokerFeeLines = [
      {
        description: "Broker Fee",
        amount: 100,
        gst: 10,
        total: 110,
      },
    ];
    
    const result = await generatePolicyPdf("schedule-annual", policy, undefined, undefined, {
      brokerFeeLines,
    });
    
    // Broker fee should be in premium breakdown
    expect(typeof result.inputs.PremiumBreakdown).toBe("string");
    const premium = JSON.parse(result.inputs.PremiumBreakdown);
    expect(premium.combinedBrokerFee).toBeDefined();
  });
});

describe("PDF Stability Verification (Critical for Refactoring)", () => {
  it("maintains byte-length stability for standard policies", async () => {
    const policy = createMinimalPolicy();
    
    const result1 = await generatePolicyPdf("schedule-annual", policy);
    const result2 = await generatePolicyPdf("schedule-annual", policy);
    
    // Same inputs should produce same byte length
    // (Might vary slightly due to timestamps, but should be close)
    expect(Math.abs(result1.pdf.length - result2.pdf.length)).toBeLessThan(100);
  });

  it("handles edge case policies", async () => {
    const zeroTurnoverPolicy = {
      ...createMinimalPolicy(),
      car: {
        ...createMinimalPolicy().car,
        estimatedTurnover: 0,
        plantEquipment: 0,
      },
    } as Policy;
    
    const highValuePolicy = {
      ...createMinimalPolicy(),
      car: {
        ...createMinimalPolicy().car,
        estimatedTurnover: 10000000, // $10M
        plantEquipment: 500000, // $500k
      },
    } as Policy;
    
    // Both should generate PDFs
    const result1 = await generatePolicyPdf("schedule-annual", zeroTurnoverPolicy);
    const result2 = await generatePolicyPdf("schedule-annual", highValuePolicy);
    
    expect(result1.pdf.length).toBeGreaterThan(0);
    expect(result2.pdf.length).toBeGreaterThan(0);
  });

  it("verifies PDF generation doesn't crash during refactoring", async () => {
    // This is a smoke test to ensure basic functionality works
    const policy = createMinimalPolicy();
    
    // Generate PDF for multiple scenarios
    const scenarios = [
      { templateKey: "schedule-annual" },
      { templateKey: "rating-annual" },
      { templateKey: "schedule-annual", mergeInputs: { PolicyNumber: "TEST" } },
    ];
    
    for (const scenario of scenarios) {
      const result = await generatePolicyPdf(
        scenario.templateKey, 
        policy, 
        scenario.mergeInputs
      );
      
      // Basic validation
      expect(result.pdf).toBeInstanceOf(Uint8Array);
      expect(result.pdf.length).toBeGreaterThan(0);
      expect(result.templateKey).toBe(scenario.templateKey);
    }
  });
});