# Integration Test Specifications - Document Generation & Premium Calculations

**Document:** Detailed specifications for integration-level testing of critical workflows
**Date:** August 13, 2026
**Status:** Specification Complete

## 1. Integration Test Strategy

### 1.1 Test Layers

| Layer | Tool | Scope | Focus Area |
|-------|------|-------|------------|
| **Component Integration** | Vitest + React Testing Library | UI component interactions | Policy wizard, forms |
| **Service Integration** | Vitest + MSW (Mock Service Worker) | Business service orchestration | Premium calculation, document generation |
| **API Integration** | Vitest + Supabase client | Database operations | Policy CRUD, document storage |
| **Worker Integration** | Vitest + Worker mocks | Background processing | Excel generation, PDF rendering |

### 1.2 Test Environment Requirements

```typescript
// Minimum test environment configuration
const testEnvironment = {
  // Database
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_ANON_KEY,
  
  // PDF Generation
  pdfmeAvailable: true, // Dynamic import fallback
  workerAvailable: true, // Excel worker reachable
  
  // Performance
  timeoutMultiplier: 2, // Longer timeouts for integration tests
  
  // Data
  seededTemplates: ["schedule-annual", "rating-annual", "premium-excel"],
  seededPolicies: ["test-policy-taken", "test-policy-pending"],
};
```

## 2. PDF Document Generation Integration Tests

### 2.1 Test Suite Structure

#### `tests/integration/pdf-generation.test.ts`
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { generatePolicyPdf } from "~/lib/pdf/generate";
import type { Policy } from "~/lib/db/types";
import { db } from "~/lib/db/client";

describe("PDF document generation integration", () => {
  // Helper to create test fixtures
  function createTestPolicy(overrides: Partial<Policy> = {}): Policy {
    return {
      policyId: "test-policy-1",
      policyNumber: "TEST001",
      clientId: "test-client-1",
      policyStatusId: 1, // Pending
      // ... complete policy object
      ...overrides,
    } as Policy;
  }

  // Mock template cache
  const mockTemplateCache = {
    getCachedPublishedTemplate: vi.fn(async (key: string) => {
      const templates = {
        "schedule-annual": createScheduleTemplate(),
        "rating-annual": createRatingTemplate(),
      };
      return templates[key] || null;
    }),
    setCachedPublishedTemplate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mock("~/lib/pdf/template-override-cache", () => mockTemplateCache);
  });

  it("generates PDF for valid policy with complete data", async () => {
    // Arrange
    const policy = createTestPolicy();
    const mergeInputs = {
      PolicyNumber: "TEST001",
      InsuredName: "Test Construction Pty Ltd",
      Address: "123 Test Street, Sydney NSW 2000",
      CoverType: "Annual",
      Period: "01/01/2026 to 31/12/2026",
      SumInsured: "$5,000,000",
      Premium: "$12,345.67",
    };

    // Act
    const result = await generatePolicyPdf(
      "schedule-annual",
      policy,
      mergeInputs,
      mockTemplateCache.getCachedPublishedTemplate("schedule-annual")
    );

    // Assert
    expect(result.pdf).toBeInstanceOf(Uint8Array);
    expect(result.pdf.length).toBeGreaterThan(1000); // Reasonable PDF size
    expect(result.templateKey).toBe("schedule-annual");
    expect(result.inputs).toEqual(expect.objectContaining(mergeInputs));
    
    // Verify PDF header
    const decoder = new TextDecoder();
    const pdfHeader = decoder.decode(result.pdf.slice(0, 5));
    expect(pdfHeader).toBe("%PDF-");
  });

  it("handles endorsement expansion correctly", async () => {
    // Test HTML endorsement expansion
    const endorsements = [
      {
        subject: "<strong>Open Trench Limitation</strong>",
        content: "<p>Maximum <u>100 metres</u> of open trench at any one time.</p>",
      },
    ];

    const result = await generatePolicyPdf(
      "schedule-annual",
      createTestPolicy(),
      {
        PolicyNumber: "TEST001",
        Endorsements: JSON.stringify(endorsements),
      },
      mockTemplateCache.getCachedPublishedTemplate("schedule-annual")
    );

    expect(result.pdf.length).toBeGreaterThan(0);
    // Additional assertions for content presence
  });

  it("falls back gracefully when template cache misses", async () => {
    // Arrange - mock cache to return null
    mockTemplateCache.getCachedPublishedTemplate.mockReturnValueOnce(null);
    
    // Mock database fallback
    vi.spyOn(db, "query").mockResolvedValueOnce({
      rows: [createScheduleTemplate()],
    });

    // Act & Assert
    await expect(
      generatePolicyPdf(
        "schedule-annual",
        createTestPolicy(),
        { PolicyNumber: "TEST001" },
        undefined
      )
    ).resolves.toHaveProperty("pdf");
  });

  it("measures PDF generation performance", async () => {
    const startTime = performance.now();
    
    const result = await generatePolicyPdf(
      "schedule-annual",
      createTestPolicy(),
      { PolicyNumber: "TEST001" },
      mockTemplateCache.getCachedPublishedTemplate("schedule-annual")
    );

    const endTime = performance.now();
    const generationTime = endTime - startTime;

    // Performance assertion
    expect(generationTime).toBeLessThan(5000); // < 5 seconds
    expect(result.pdf.length).toBeGreaterThan(0);
    
    // Log performance for monitoring
    console.log(`PDF generation took ${generationTime.toFixed(2)}ms`);
  });
});
```

### 2.2 Performance Test Specifications

#### `tests/integration/pdf-performance.test.ts`
```typescript
import { describe, expect, it, beforeAll } from "vitest";
import { generatePolicyPdf } from "~/lib/pdf/generate";

describe("PDF generation performance benchmarks", () => {
  const SAMPLE_SIZE = 10;
  const TARGET_TIME_MS = 5000; // 5 seconds
  
  // Test data generation utilities
  function generateTestData(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      policyNumber: `PERF${i.toString().padStart(3, "0")}`,
      insuredName: `Performance Test Company ${i}`,
      endorsements: generateEndorsements(i % 5), // Varying endorsement count
    }));
  }

  it("generates multiple PDFs within acceptable time", async () => {
    const testData = generateTestData(SAMPLE_SIZE);
    const results = [];
    
    for (const data of testData) {
      const startTime = performance.now();
      
      const pdf = await generatePolicyPdf(
        "schedule-annual",
        createTestPolicy({ policyNumber: data.policyNumber }),
        data,
        await getTemplate("schedule-annual")
      );
      
      const endTime = performance.now();
      results.push({
        timeMs: endTime - startTime,
        sizeBytes: pdf.pdf.length,
        policyNumber: data.policyNumber,
      });
    }
    
    // Assertions
    const averageTime = results.reduce((sum, r) => sum + r.timeMs, 0) / results.length;
    const maxTime = Math.max(...results.map(r => r.timeMs));
    
    expect(averageTime).toBeLessThan(TARGET_TIME_MS * 0.8); // 80% of target
    expect(maxTime).toBeLessThan(TARGET_TIME_MS * 1.5); // 150% of target
    
    // Output performance report
    console.table(results.map(r => ({
      Policy: r.policyNumber,
      "Time (ms)": r.timeMs.toFixed(2),
      "Size (KB)": (r.sizeBytes / 1024).toFixed(2),
    })));
  });

  it("handles concurrent PDF generation", async () => {
    const CONCURRENT_COUNT = 3;
    const testData = generateTestData(CONCURRENT_COUNT);
    
    const startTime = performance.now();
    
    // Generate PDFs concurrently
    const promises = testData.map(data =>
      generatePolicyPdf(
        "schedule-annual",
        createTestPolicy({ policyNumber: data.policyNumber }),
        data,
        await getTemplate("schedule-annual")
      )
    );
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Verify all PDFs generated
    results.forEach((result, index) => {
      expect(result.pdf.length).toBeGreaterThan(1000);
      expect(result.templateKey).toBe("schedule-annual");
    });
    
    // Performance assertion - concurrent should be faster than sequential
    expect(totalTime).toBeLessThan(TARGET_TIME_MS * CONCURRENT_COUNT * 0.7);
  });
});
```

### 2.3 Golden Reference Testing

#### `tests/integration/pdf-golden-references.test.ts`
```typescript
import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { generatePolicyPdf } from "~/lib/pdf/generate";

// Golden reference directory
const GOLDEN_DIR = join(__dirname, "../../golden-references/pdf");

describe("PDF golden reference comparisons", () => {
  let goldenReferences: Map<string, Uint8Array>;
  
  beforeAll(async () => {
    // Load golden references
    goldenReferences = new Map();
    
    const references = [
      { name: "simple-policy", file: "simple-policy.pdf" },
      { name: "with-endorsements", file: "with-endorsements.pdf" },
      { name: "large-endorsements", file: "large-endorsements.pdf" },
    ];
    
    for (const ref of references) {
      try {
        const filePath = join(GOLDEN_DIR, ref.file);
        const buffer = readFileSync(filePath);
        goldenReferences.set(ref.name, new Uint8Array(buffer));
      } catch (error) {
        console.warn(`Could not load golden reference: ${ref.name}`);
      }
    }
  });

  it("matches golden reference for simple policy", async () => {
    const goldenPdf = goldenReferences.get("simple-policy");
    if (!goldenPdf) {
      test.skip("Golden reference not available");
      return;
    }
    
    // Generate PDF with same inputs
    const generatedPdf = await generatePolicyPdf(
      "schedule-annual",
      createSimplePolicy(),
      createSimpleInputs(),
      await getTemplate("schedule-annual")
    );
    
    // Compare PDFs (with tolerance for metadata differences)
    const comparison = comparePdfs(goldenPdf, generatedPdf.pdf, {
      tolerance: 100, // Allow 100 byte differences (timestamps, IDs)
      ignoreRanges: [
        [0, 100], // PDF header
        [generatedPdf.pdf.length - 100, generatedPdf.pdf.length], // Trailer
      ],
    });
    
    expect(comparison.matches).toBe(true);
    expect(comparison.differences).toBeLessThan(100);
  });

  it("detects regression when PDF generation changes", async () => {
    const goldenPdf = goldenReferences.get("with-endorsements");
    if (!goldenPdf) {
      test.skip("Golden reference not available");
      return;
    }
    
    // Introduce intentional change (different endorsement formatting)
    const changedInputs = {
      ...createEndorsementInputs(),
      Endorsements: JSON.stringify([
        {
          subject: "CHANGED - Open Trench Limitation",
          content: "CHANGED - Maximum 100 metres",
        },
      ]),
    };
    
    const generatedPdf = await generatePolicyPdf(
      "schedule-annual",
      createTestPolicy(),
      changedInputs,
      await getTemplate("schedule-annual")
    );
    
    const comparison = comparePdfs(goldenPdf, generatedPdf.pdf, {
      tolerance: 50,
    });
    
    // Changed inputs should produce different PDF
    expect(comparison.matches).toBe(false);
    expect(comparison.differences).toBeGreaterThan(500);
  });
});
```

## 3. Excel Document Generation Integration Tests

### 3.1 Excel Worker Integration Tests

#### `tests/integration/excel-generation.test.ts`
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { generatePremiumExcel } from "~/lib/pricing/premium-excel";
import type { Policy } from "~/lib/db/types";

// Mock Excel worker
const mockExcelWorker = {
  generate: vi.fn(async (policy: Policy) => {
    // Simulate Excel generation
    return new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, // ZIP header (Excel is ZIP)
      // ... simulated Excel content
    ]);
  }),
};

describe("Excel document generation integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mock("~/lib/pricing/premium-excel-worker", () => ({
      default: mockExcelWorker,
    }));
  });

  it("generates Excel working sheet for policy", async () => {
    // Arrange
    const policy = createTestPolicy({
      car: {
        estimatedTurnover: 1000000,
        contractWorksSumInsured: 3000000,
        premium: {
          originalTotalPremium: 2329.54,
          contractWorksTotalPremium: 1630.04,
          liabilityTotalPremium: 599.5,
        },
      },
    });

    // Act
    const excelResult = await generatePremiumExcel(policy);

    // Assert
    expect(excelResult).toBeInstanceOf(Uint8Array);
    expect(excelResult.length).toBeGreaterThan(1000); // Reasonable Excel size
    
    // Verify Excel header (ZIP format)
    expect(excelResult[0]).toBe(0x50); // 'P'
    expect(excelResult[1]).toBe(0x4B); // 'K'
    
    // Verify worker was called
    expect(mockExcelWorker.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        policyNumber: "TEST001",
      })
    );
  });

  it("updates fingerprint when premium changes", async () => {
    const policy1 = createTestPolicy({
      car: {
        estimatedTurnover: 1000000,
        premium: { originalTotalPremium: 1000 },
      },
    });

    const policy2 = createTestPolicy({
      car: {
        estimatedTurnover: 1200000, // 20% increase
        premium: { originalTotalPremium: 1200 },
      },
    });

    // Generate fingerprints
    const fingerprint1 = await computeExcelFingerprint(policy1);
    const fingerprint2 = await computeExcelFingerprint(policy2);

    // Different premiums should produce different fingerprints
    expect(fingerprint1).not.toBe(fingerprint2);
  });

  it("handles adjustment premium differences", async () => {
    const basePolicy = createTestPolicy({
      car: {
        adjusted: false,
        premium: { originalTotalPremium: 1000 },
      },
    });

    const adjustedPolicy = createTestPolicy({
      car: {
        adjusted: true,
        adjustment: {
          adjustedTurnover: 1200000,
          adjustedTotalPremium: 800, // 20% decrease
          stampDutyExempt: false,
          adjustedDate: "2026-06-01",
        },
        premium: { originalTotalPremium: 1000 },
      },
    });

    const baseExcel = await generatePremiumExcel(basePolicy);
    const adjustedExcel = await generatePremiumExcel(adjustedPolicy);

    // Adjusted premium should produce different Excel
    expect(baseExcel).not.toEqual(adjustedExcel);
    
    // Verify adjustment flag affects content
    const baseText = new TextDecoder().decode(baseExcel.slice(0, 200));
    const adjustedText = new TextDecoder().decode(adjustedExcel.slice(0, 200));
    
    expect(adjustedText).toContain("ADJUSTED");
    expect(adjustedText).toContain("800");
  });

  it("performance: Excel generation within time limits", async () => {
    const policy = createTestPolicy();
    const startTime = performance.now();
    
    const excel = await generatePremiumExcel(policy);
    
    const endTime = performance.now();
    const generationTime = endTime - startTime;

    // Performance assertions
    expect(generationTime).toBeLessThan(3000); // < 3 seconds
    expect(excel.length).toBeGreaterThan(0);
    
    // Verify content
    expect(mockExcelWorker.generate).toHaveBeenCalledTimes(1);
  });
});
```

### 3.2 Excel Worker Contract Tests

#### `tests/integration/excel-worker-contract.test.ts`
```typescript
import { describe, expect, it } from "vitest";
import type { ExcelWorkerRequest, ExcelWorkerResponse } from "~/workers/excel/types";

describe("Excel worker contract validation", () => {
  it("validates worker request schema", async () => {
    const validRequest: ExcelWorkerRequest = {
      policyId: "test-1",
      policyNumber: "TEST001",
      insuredName: "Test Company",
      dateStart: "2026-01-01",
      dateEnd: "2026-12-31",
      premiumDetails: {
        contractWorksTotalPremium: 1630.04,
        liabilityTotalPremium: 599.5,
        combinedBrokerFee: 100,
        originalTotalPremium: 2329.54,
      },
      adjustments: null,
      manualPremiumKeys: [],
    };

    // Schema validation should pass
    expect(() => validateExcelRequest(validRequest)).not.toThrow();
    
    // Test invalid requests
    const invalidRequests = [
      { ...validRequest, policyId: undefined }, // Missing required field
      { ...validRequest, premiumDetails: {} }, // Invalid premium details
      { ...validRequest, dateStart: "invalid-date" }, // Invalid date format
    ];

    invalidRequests.forEach((invalidRequest, index) => {
      expect(() => validateExcelRequest(invalidRequest)).toThrow();
    });
  });

  it("validates worker response schema", async () => {
    const validResponse: ExcelWorkerResponse = {
      success: true,
      excelBytes: new Uint8Array([0x50, 0x4B, 0x03, 0x04]),
      filename: "TEST001_Premium.xlsx",
      generatedAt: new Date().toISOString(),
      fingerprint: "excel|abc123",
    };

    // Schema validation should pass
    expect(() => validateExcelResponse(validResponse)).not.toThrow();
    
    // Test edge cases
    const edgeCases = [
      { ...validResponse, success: false, error: "Generation failed" }, // Error case
      { ...validResponse, excelBytes: new Uint8Array(0) }, // Empty Excel
      { ...validResponse, filename: "test.xls" }, // Different extension
    ];

    edgeCases.forEach((edgeCase, index) => {
      expect(() => validateExcelResponse(edgeCase)).not.toThrow();
    });
  });

  it("ensures backward compatibility", async () => {
    // Test that current worker can handle older request formats
    const legacyRequest = {
      policyId: "legacy-1",
      policyNumber: "LEGACY001",
      // Older field names/structures
      premium: {
        total: 1000,
        breakdown: {},
      },
    };

    // Worker should handle or transform legacy format
    const response = await mockExcelWorker.generate(legacyRequest);
    
    expect(response).toBeInstanceOf(Uint8Array);
    expect(response.length).toBeGreaterThan(0);
  });
});
```

## 4. Premium Calculation Integration Tests

### 4.1 Calculation Service Integration Tests

#### `tests/integration/premium-calculation.test.ts`
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { calculatePremium } from "~/lib/services/price/premium.service";
import type { Policy, CarPolicy } from "~/lib/db/types";
import { db } from "~/lib/db/client";

describe("Premium calculation service integration", () => {
  // Mock database interactions
  const mockDb = {
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mock("~/lib/db/client", () => ({ db: mockDb }));
    
    // Mock rate lookup
    mockDb.query.mockResolvedValue({
      rows: [
        { rate: 0.0015, min: 500, max: 5000 }, // Contract works rate
        { rate: 0.0008, min: 300, max: 3000 }, // Liability rate
        { eslRate: 0.105, gstRate: 0.10, stampDutyRate: 0.095 }, // Taxes
      ],
    });
  });

  it("calculates premium with default values", async () => {
    // Arrange
    const carPolicy: CarPolicy = {
      estimatedTurnover: 1000000,
      contractWorksSumInsured: 3000000,
      liabilityLimitBand: 3,
      plantEquipment: 50000,
      existingStructure: 0,
      displayHomes: 0,
      maximumConstructionPeriod: 12,
      maximumMaintenancePeriod: 12,
    };

    const policy: Policy = createTestPolicy({ car: carPolicy });

    // Act
    const premium = await calculatePremium(policy);

    // Assert
    expect(premium.originalTotalPremium).toBeGreaterThan(0);
    expect(premium.contractWorksTotalPremium).toBeGreaterThan(0);
    expect(premium.liabilityTotalPremium).toBeGreaterThan(0);
    
    // Verify breakdown
    expect(premium.contractWorksBasePremium).toBeGreaterThan(0);
    expect(premium.contractWorksTerrorismPremium).toBeGreaterThan(0);
    expect(premium.contractWorksESL).toBeGreaterThan(0);
    expect(premium.contractWorksGST).toBeGreaterThan(0);
    expect(premium.contractWorksStampDuty).toBeGreaterThan(0);
    
    // Total should match sum of components (within rounding)
    const calculatedTotal = 
      premium.contractWorksTotalPremium + 
      premium.liabilityTotalPremium;
    
    expect(premium.originalTotalPremium).toBeCloseTo(calculatedTotal, 2);
  });

  it("applies 25%/75% rule during adjustment", async () => {
    const originalPolicy = createTestPolicy({
      car: {
        estimatedTurnover: 1000000,
        contractWorksSumInsured: 3000000,
        premium: { originalTotalPremium: 2329.54 },
      },
    });

    // Test within bounds (20% increase)
    const withinBoundsPolicy = createTestPolicy({
      car: {
        ...originalPolicy.car,
        estimatedTurnover: 1200000, // 20% increase
      },
    });

    const withinBoundsPremium = await calculatePremium(withinBoundsPolicy);
    const percentageChange = 
      (withinBoundsPremium.originalTotalPremium / originalPolicy.car.premium.originalTotalPremium) * 100;

    expect(percentageChange).toBeGreaterThanOrEqual(25); // ≥ 25%
    expect(percentageChange).toBeLessThanOrEqual(75); // ≤ 75%

    // Test outside bounds (200% increase)
    const outsideBoundsPolicy = createTestPolicy({
      car: {
        ...originalPolicy.car,
        estimatedTurnover: 3000000, // 200% increase
      },
    });

    const outsideBoundsPremium = await calculatePremium(outsideBoundsPolicy);
    const outsidePercentageChange = 
      (outsideBoundsPremium.originalTotalPremium / originalPolicy.car.premium.originalTotalPremium) * 100;

    expect(outsidePercentageChange).toBeGreaterThan(75); // > 75% - should trigger validation
  });

  it("handles manual premium overrides", async () => {
    const policy = createTestPolicy({
      car: {
        estimatedTurnover: 1000000,
        contractWorksSumInsured: 3000000,
        premiumManualKeys: ["contractWorksBasePremium"],
        premium: {
          contractWorksBasePremium: 1500, // Manual override
          // ... other premiums calculated normally
        },
      },
    });

    const premium = await calculatePremium(policy);

    // Manual override should be preserved
    expect(premium.contractWorksBasePremium).toBe(1500);
    
    // Other premiums should still be calculated
    expect(premium.contractWorksTerrorismPremium).toBeGreaterThan(0);
    expect(premium.contractWorksESL).toBeGreaterThan(0);
    
    // Verify manual flag
    expect(policy.car.premiumManualKeys).toContain("contractWorksBasePremium");
  });
});
```

## 5. Performance Benchmark Specifications

### 5.1 Performance Test Suite

#### `tests/integration/performance-benchmarks.test.ts`
```typescript
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { generatePolicyPdf } from "~/lib/pdf/generate";
import { calculatePremium } from "~/lib/services/price/premium.service";
import { generatePremiumExcel } from "~/lib/pricing/premium-excel";

describe("Performance benchmarks", () => {
  const PERFORMANCE_LOG: Array<{
    test: string;
    operation: string;
    timeMs: number;
    sizeBytes?: number;
    samples: number;
  }> = [];

  afterAll(() => {
    // Output performance report
    console.log("\n=== Performance Benchmark Results ===");
    console.table(PERFORMANCE_LOG.map(entry => ({
      Test: entry.test,
      Operation: entry.operation,
      "Avg Time (ms)": entry.timeMs.toFixed(2),
      "Size (KB)": entry.sizeBytes ? (entry.sizeBytes / 1024).toFixed(2) : "N/A",
      Samples: entry.samples,
    })));
  });

  it("benchmarks PDF generation", async () => {
    const SAMPLES = 5;
    const times: number[] = [];
    const sizes: number[] = [];

    for (let i = 0; i < SAMPLES; i++) {
      const startTime = performance.now();
      
      const pdf = await generatePolicyPdf(
        "schedule-annual",
        createTestPolicy({ policyNumber: `PERF${i}` }),
        createSimpleInputs(),
        await getTemplate("schedule-annual")
      );
      
      const endTime = performance.now();
      
      times.push(endTime - startTime);
      sizes.push(pdf.pdf.length);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;

    // Assertions
    expect(avgTime).toBeLessThan(5000); // < 5 seconds average
    expect(Math.max(...times)).toBeLessThan(10000); // No single generation > 10s
    
    PERFORMANCE_LOG.push({
      test: "PDF Generation",
      operation: "generatePolicyPdf",
      timeMs: avgTime,
      sizeBytes: avgSize,
      samples: SAMPLES,
    });
  });

  it("benchmarks premium calculation", async () => {
    const SAMPLES = 10;
    const times: number[] = [];

    for (let i = 0; i < SAMPLES; i++) {
      const policy = createTestPolicy({
        car: {
          estimatedTurnover: 1000000 + i * 100000, // Varying turnover
          contractWorksSumInsured: 3000000 + i * 200000, // Varying sum insured
        },
      });

      const startTime = performance.now();
      await calculatePremium(policy);
      const endTime = performance.now();
      
      times.push(endTime - startTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

    // Premium calculation should be very fast
    expect(avgTime).toBeLessThan(100); // < 100ms average
    expect(Math.max(...times)).toBeLessThan(500); // No single calculation > 500ms
    
    PERFORMANCE_LOG.push({
      test: "Premium Calculation",
      operation: "calculatePremium",
      timeMs: avgTime,
      samples: SAMPLES,
    });
  });

  it("benchmarks Excel generation", async () => {
    const SAMPLES = 3; // Excel generation is more expensive
    const times: number[] = [];
    const sizes: number[] = [];

    for (let i = 0; i < SAMPLES; i++) {
      const policy = createTestPolicy({
        policyNumber: `XL${i}`,
      });

      const startTime = performance.now();
      const excel = await generatePremiumExcel(policy);
      const endTime = performance.now();
      
      times.push(endTime - startTime);
      sizes.push(excel.length);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;

    // Excel generation may be slower
    expect(avgTime).toBeLessThan(3000); // < 3 seconds average
    expect(Math.max(...times)).toBeLessThan(5000); // No single generation > 5s
    
    PERFORMANCE_LOG.push({
      test: "Excel Generation",
      operation: "generatePremiumExcel",
      timeMs: avgTime,
      sizeBytes: avgSize,
      samples: SAMPLES,
    });
  });
});
```

## 6. Implementation Checklist

### ✅ Completed Specifications
- [x] PDF generation integration tests
- [x] Performance benchmarking tests  
- [x] Excel worker integration tests
- [x] Premium calculation service tests
- [x] Golden reference comparison tests

### 🚧 Pending Implementation
- [ ] Create actual test files from specifications
- [ ] Set up test fixtures and mocks
- [ ] Implement golden reference capture tool
- [ ] Configure CI pipeline for performance testing
- [ ] Add monitoring and alerting for regressions

## 7. Risk Assessment

| Risk Area | Likelihood | Impact | Mitigation |
|-----------|------------|--------|------------|
| Flaky Performance Tests | Medium | High | Use statistical analysis, exclude outliers |
| Golden Reference Maintenance | High | Medium | Automate reference updates, version control |
| Worker Bundle Size | Low | High | Regular bundle analysis, code splitting |
| Test Data Isolation | Medium | Medium | Clean test data, transaction rollback |

## 8. Success Criteria

### Test Coverage Goals:
- **Integration Tests**: 80% coverage of document generation workflows
- **Performance Tests**: All operations meet target response times
- **Golden References**: Key scenarios captured and maintained
- **Contract Tests**: All worker interfaces validated

### Performance Targets:
- PDF Generation: < 5s (95th percentile)
- Premium Calculation: < 100ms (average)
- Excel Generation: < 3s (95th percentile)
- End-to-end Quote-to-Taken: < 30s (complete journey)

---

**Next Steps**: Begin implementation by fixing existing PDF integration test mocking issues, then proceed with creating the specified test suites in priority order.

**Resources Needed**: Test database with seeded templates, CI pipeline with performance monitoring, regular maintenance schedule for golden references.