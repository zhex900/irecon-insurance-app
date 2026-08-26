import { describe, expect, it } from "vitest";

import { policyDocumentIdentityKey } from "~/lib/db/policy-document-identity";

describe("policyDocumentIdentityKey", () => {
  it("includes template and generation key", () => {
    expect(
      policyDocumentIdentityKey({
        templateKey: "schedule-annual",
        libraryDocumentId: null,
        filename: "ignored.pdf",
        generationKey: "gen-1",
      }),
    ).toBe("template:schedule-annual|gen-1");
  });

  it("uses library id when template key is absent", () => {
    expect(
      policyDocumentIdentityKey({
        templateKey: null,
        libraryDocumentId: 42,
        filename: "doc.pdf",
        generationKey: "gen-2",
      }),
    ).toBe("library:42|gen-2");
  });

  it("falls back to normalized filename", () => {
    expect(
      policyDocumentIdentityKey({
        templateKey: null,
        libraryDocumentId: null,
        filename: " Legacy.PDF ",
        generationKey: "gen-3",
      }),
    ).toBe("fixed:legacy.pdf|gen-3");
  });
});
