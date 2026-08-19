import { describe, expect, it } from "vitest";

import { parseExcelExportResponse } from "~/components/policies/wizard/hooks/documents/document-utils";

describe("parseExcelExportResponse", () => {
  it("returns filename and pdf payload from a successful response", () => {
    expect(
      parseExcelExportResponse(
        { document: { filename: "premium.xlsx", pdfBase64: "abc" } },
        true,
      ),
    ).toEqual({ filename: "premium.xlsx", pdfBase64: "abc" });
  });

  it("throws the server error when the response is not ok", () => {
    expect(() =>
      parseExcelExportResponse({ error: "Premium not calculated" }, false),
    ).toThrow("Premium not calculated");
  });

  it("throws when the document is missing a filename", () => {
    expect(() => parseExcelExportResponse({ document: {} }, true)).toThrow(
      "Failed to generate Excel",
    );
  });
});
