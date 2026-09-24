import { beforeEach, describe, expect, it, vi } from "vitest";

import { ValidationError } from "~/lib/errors";
import {
  generatePremiumExcelBodySchema,
  generatePremiumExcelDocument,
} from "~/lib/excel/generate-premium.server";
import { getPolicy } from "~/lib/services/policy/data.service";

import { MAX_REQUEST_SIZE_BYTES } from "../../workers/excel/constants/config";
import { generateGenericExcel } from "../../workers/excel/handler/generate-generic-excel";
import { generatePremiumExcel } from "../../workers/excel/handler/generate-premium-excel";
import {
  customReportDataSchema,
  generatePremiumExcelRequestSchema,
} from "../../workers/excel/types/schemas";

vi.mock("~/lib/services/policy/data.service", () => ({
  getPolicy: vi.fn(),
}));

vi.mock("~/lib/observability/metrics.server", () => ({
  trackUsage: vi.fn(),
  trackDistribution: vi.fn(),
}));

const POLICY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const premiumWorkbookData = {
  policy: {
    policyId: POLICY_ID,
    policyNumber: "ATCCWI1",
    stateId: 1,
    car: {
      coverTypeId: 1,
      siteAddress: "1 Test St",
      insuredName: "Acme",
      estimatedTurnover: 1_000_000,
      plantEquipment: 0,
      existingStructure: 0,
      displayHomes: 0,
      contractWorksSumInsured: 1_000_000,
      liabilityLimitBand: 10,
      contractWorksExistingStructurePremium: 0,
      contractWorksDisplayHomesPremium: 0,
    },
  },
  premium: {
    contractWorksCalculatedBasePremium: 100,
    contractWorksBasePremium: 100,
    contractWorksPlantPremium: 0,
    contractWorksPlantESL: 0,
    contractWorksESL: 10,
    contractWorksGST: 11,
    contractWorksStampDuty: 5,
    contractWorksTerrorismPremium: 1,
    contractWorksPlantTerrorismPremium: 0,
    contractWorksDisplayHomesPremium: 0,
    contractWorksExistingStructurePremium: 0,
    contractWorksTotalPremium: 127,
    liabilityCalculatedBasePremium: 50,
    liabilityBasePremium: 50,
    liabilityESL: 5,
    liabilityGST: 5,
    liabilityStampDuty: 2,
    liabilityTotalPremium: 62,
    combinedBrokerFee: 0,
    originalTotalPremium: 189,
  },
  rating: {
    contractWorksAppliedRate: 0.2,
    liabilityAppliedRate: 0.1,
    contractWorksMinPremium: 0,
    liabilityMinPremium: 0,
    eslRate: 0.05,
    plantEslRate: 0.05,
    plantRate: 0,
    contractWorksStampDutyRate: 0.05,
    liabilityStampDutyRate: 0.05,
    terrorismRate: 0.01,
    terrorismTier: "A",
  },
};

describe("generate premium excel request schema", () => {
  it("rejects a non-premium report type", () => {
    const parsed = generatePremiumExcelRequestSchema.safeParse({
      reportType: "custom",
      data: premiumWorkbookData,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a key-sniff payload that is not a full premium workbook", () => {
    const parsed = generatePremiumExcelRequestSchema.safeParse({
      reportType: "premiumWorkbook",
      data: {
        policy: { policyId: POLICY_ID, policyNumber: "SECRET-POL", car: {} },
        premium: { contractWorksBasePremium: 100 },
        rating: { contractWorksAppliedRate: 0.2 },
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a complete premium workbook payload", () => {
    const parsed = generatePremiumExcelRequestSchema.safeParse({
      reportType: "premiumWorkbook",
      data: premiumWorkbookData,
      options: { generatedBy: "user-1", policyNumber: "ATCCWI1" },
    });
    expect(parsed.success).toBe(true);
  });
});

describe("custom report bounds", () => {
  it("rejects oversized column lists", () => {
    const parsed = customReportDataSchema.safeParse({
      columns: Array.from({ length: 51 }, (_, i) => ({
        key: `c${i}`,
        header: `Col ${i}`,
      })),
      rows: [],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("premium excel handler errors", () => {
  it("does not echo the request payload on validation failure", async () => {
    const response = await generatePremiumExcel({
      reportType: "premiumWorkbook",
      data: {
        policy: { policyId: POLICY_ID, policyNumber: "SECRET-POL", car: {} },
        premium: { contractWorksBasePremium: 1 },
      },
    });
    expect(response.status).toBe(400);
    const body = await response.text();
    expect(body).toContain("Invalid premium workbook request");
    expect(body).not.toContain("SECRET-POL");
    expect(body).not.toContain(POLICY_ID);
  });

  it("rejects oversized payloads without echoing the body", async () => {
    const response = await generatePremiumExcel({
      reportType: "premiumWorkbook",
      data: { pad: "x".repeat(MAX_REQUEST_SIZE_BYTES) },
    });
    expect(response.status).toBe(413);
    const body = await response.text();
    expect(body).toBe(JSON.stringify({ error: "payload_too_large" }));
  });
});

describe("generic excel handler errors", () => {
  it("rejects oversized payloads without echoing the body", async () => {
    const response = await generateGenericExcel({
      reportType: "custom",
      data: { pad: "x".repeat(MAX_REQUEST_SIZE_BYTES) },
    });
    expect(response.status).toBe(413);
    const body = await response.text();
    expect(body).toBe(JSON.stringify({ error: "payload_too_large" }));
  });
});

describe("generatePremiumExcel body schema", () => {
  it("accepts only policyId", () => {
    expect(
      generatePremiumExcelBodySchema.safeParse({
        policyId: POLICY_ID,
        premium: { forged: true },
      }).success,
    ).toBe(false);
    expect(
      generatePremiumExcelBodySchema.parse({ policyId: POLICY_ID }),
    ).toEqual({ policyId: POLICY_ID });
  });
});

describe("generatePremiumExcelDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the policy from the database and stamps session generatedBy", async () => {
    vi.mocked(getPolicy).mockResolvedValue({
      policyId: POLICY_ID,
      policyNumber: "ATCCWI1001",
      seriesNumber: "ATCCWI0487",
      postcode: "2000",
      stateId: 1,
      dateStart: "2026-01-01",
      dateEnd: "2027-01-01",
      car: {
        coverTypeId: 1,
        siteAddress: "1 Test St",
        insuredName: "Acme",
        estimatedTurnover: 1_000_000,
        plantEquipment: 0,
        existingStructure: 0,
        displayHomes: 0,
        contractWorksSumInsured: 1_000_000,
        liabilityLimitBand: 10,
        contractWorksExistingStructurePremium: 0,
        contractWorksDisplayHomesPremium: 0,
        premium: {
          contractWorksCalculatedBasePremium: 100,
          contractWorksBasePremium: 100,
          contractWorksPlantPremium: 0,
          contractWorksPlantESL: 0,
          contractWorksESL: 10,
          contractWorksGST: 11,
          contractWorksStampDuty: 5,
          contractWorksTerrorismPremium: 1,
          contractWorksPlantTerrorismPremium: 0,
          contractWorksDisplayHomesPremium: 0,
          contractWorksExistingStructurePremium: 0,
          contractWorksTotalPremium: 127,
          liabilityCalculatedBasePremium: 50,
          liabilityBasePremium: 50,
          liabilityESL: 5,
          liabilityGST: 5,
          liabilityStampDuty: 2,
          liabilityTotalPremium: 62,
          combinedBrokerFee: 0,
          originalTotalPremium: 189,
        },
      },
    } as Awaited<ReturnType<typeof getPolicy>>);

    const excelBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
    const generatePremiumExcelRpc = vi
      .fn()
      .mockResolvedValue(new Response(excelBytes, { status: 200 }));

    const document = await generatePremiumExcelDocument({
      policyId: POLICY_ID,
      generatedBy: "session-user",
      excelService: {
        generatePremiumExcel: generatePremiumExcelRpc,
        generateGenericExcel: vi.fn(),
      },
    });

    expect(getPolicy).toHaveBeenCalledWith(POLICY_ID);
    expect(generatePremiumExcelRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: "premiumWorkbook",
        data: expect.objectContaining({
          policy: expect.objectContaining({ seriesNumber: "ATCCWI0487" }),
        }),
        options: expect.objectContaining({
          generatedBy: "session-user",
          policyNumber: "ATCCWI0487",
        }),
      }),
    );
    expect(document.filename).toContain("ATCCWI0487");
    expect(document.pdfBase64).toBeTruthy();
    expect(typeof document.pdfBase64).toBe("string");
  });

  it("throws when the policy has no stored premium", async () => {
    vi.mocked(getPolicy).mockResolvedValue({
      policyId: POLICY_ID,
      policyNumber: "ATCCWI1001",
      car: {},
    } as Awaited<ReturnType<typeof getPolicy>>);

    await expect(
      generatePremiumExcelDocument({
        policyId: POLICY_ID,
        generatedBy: "session-user",
        excelService: {
          generatePremiumExcel: vi.fn(),
          generateGenericExcel: vi.fn(),
        },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
