import { describe, expect, it } from "vitest";
import type { PolicyDocument } from "~/lib/db/types";
import type { Policy } from "~/lib/db/types";
import {
  isPremiumExcelDocument,
  PREMIUM_EXCEL_TEMPLATE_KEY,
  premiumExcelExportEnabled,
  premiumExcelFingerprint,
} from "~/lib/premium-excel";

function doc(partial: Partial<PolicyDocument>): PolicyDocument {
  return {
    policyDocumentId: 1,
    policyId: 1,
    name: "Premium Excel",
    filename: "P1_Premium.xlsx",
    generationKey: "excel|abc",
    content: "",
    generatedWhen: new Date().toISOString(),
    generatedBy: "test",
    ...partial,
  };
}

describe("premium excel helpers", () => {
  it("detects excel documents by template key or extension", () => {
    expect(
      isPremiumExcelDocument(doc({ templateKey: PREMIUM_EXCEL_TEMPLATE_KEY })),
    ).toBe(true);
    expect(
      isPremiumExcelDocument(
        doc({ templateKey: undefined, filename: "note.xlsx" }),
      ),
    ).toBe(true);
    expect(
      isPremiumExcelDocument(
        doc({ templateKey: "car-schedule", filename: "s.pdf" }),
      ),
    ).toBe(false);
  });

  it("enables export when missing or fingerprint changed", () => {
    expect(premiumExcelExportEnabled([], "excel|a")).toBe(true);
    expect(
      premiumExcelExportEnabled([doc({ generationKey: "excel|a" })], "excel|a"),
    ).toBe(false);
    expect(
      premiumExcelExportEnabled([doc({ generationKey: "excel|a" })], "excel|b"),
    ).toBe(true);
  });

  it("changes fingerprint when adjustment is applied", () => {
    const base = {
      policyNumber: "P1",
      policyStatusId: 1,
      dateStart: "2024-01-01",
      dateEnd: "2025-01-01",
      stateId: 2,
      postcode: "2000",
      insurerCode: "X",
      car: {
        insuredName: "Acme",
        siteAddress: "1 St",
        estimatedTurnover: 1_000_000,
        contractWorksSumInsured: 1_000_000,
        displayHomes: 0,
        existingStructure: 0,
        plantEquipment: 0,
        liabilityLimitBand: 1,
        businessActivities: "",
        insuredContracts: "",
        geographicalScopes: "",
        maximumConstructionPeriod: 12,
        maximumMaintenancePeriod: 12,
        adjusted: false,
        premium: { originalTotalPremium: 100 },
      },
    } as unknown as Policy;

    const before = premiumExcelFingerprint(base);
    const after = premiumExcelFingerprint({
      ...base,
      car: {
        ...base.car,
        adjusted: true,
        adjustment: {
          adjustedTurnover: 1_200_000,
          adjustedTotalPremium: 50,
          stampDutyExempt: false,
          adjustedDate: "2025-06-01",
        },
      },
    } as unknown as Policy);

    expect(after).not.toBe(before);
    expect(after).toContain("adjusted");
  });
});
