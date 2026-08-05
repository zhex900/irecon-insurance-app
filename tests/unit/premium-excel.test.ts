import { describe, expect, it } from "vitest";
import type { PolicyDocument } from "~/lib/db/types";
import {
  isPremiumExcelDocument,
  PREMIUM_EXCEL_TEMPLATE_KEY,
  premiumExcelExportEnabled,
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
});
