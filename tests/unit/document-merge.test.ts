import { describe, expect, it } from "vitest";
import type { PolicyDocument } from "~/lib/db/types";
import {
  nextAmendmentNumber,
  nextDocumentId,
} from "~/lib/services/policy/documents/content";
import { mergeReviewDocuments } from "~/lib/services/policy/documents/merge";

function doc(
  partial: Partial<PolicyDocument> &
    Pick<PolicyDocument, "policyDocumentId" | "documentTypeCode" | "filename">,
): PolicyDocument {
  return {
    policyId: 1,
    name: partial.filename,
    generationKey: "gen-a",
    content: "",
    generatedWhen: "2026-01-01T00:00:00.000Z",
    generatedBy: "test",
    ...partial,
  };
}

describe("document id helpers", () => {
  it("nextDocumentId continues from max id", () => {
    expect(nextDocumentId([])).toBe(1);
    expect(
      nextDocumentId([
        doc({
          policyDocumentId: 3,
          documentTypeCode: "CARSCHED",
          filename: "a.pdf",
        }),
        doc({
          policyDocumentId: 7,
          documentTypeCode: "CARRATING",
          filename: "b.pdf",
        }),
      ]),
    ).toBe(8);
  });

  it("nextAmendmentNumber counts by type", () => {
    const existing = [
      doc({
        policyDocumentId: 1,
        documentTypeCode: "CARSCHED",
        filename: "s1.pdf",
      }),
      doc({
        policyDocumentId: 2,
        documentTypeCode: "CARSCHED",
        filename: "s2.pdf",
      }),
      doc({
        policyDocumentId: 3,
        documentTypeCode: "CARRATING",
        filename: "r1.pdf",
      }),
    ];
    expect(nextAmendmentNumber(existing, "CARSCHED")).toBe(2);
    expect(nextAmendmentNumber(existing, "CARADJUST")).toBe(0);
  });
});

describe("mergeReviewDocuments", () => {
  it("returns current when pack fingerprint already present and fixed docs exist", () => {
    const existing = [
      doc({
        policyDocumentId: 1,
        documentTypeCode: "CARSCHED",
        filename: "sched.pdf",
        generationKey: "same",
      }),
      doc({
        policyDocumentId: 2,
        documentTypeCode: "CARADDIT",
        filename: "lib.pdf",
        generationKey: "same",
      }),
    ];
    const pack = [
      doc({
        policyDocumentId: 99,
        documentTypeCode: "CARSCHED",
        filename: "sched-new.pdf",
        generationKey: "same",
      }),
      doc({
        policyDocumentId: 100,
        documentTypeCode: "CARADDIT",
        filename: "lib.pdf",
        generationKey: "same",
      }),
    ];
    expect(mergeReviewDocuments(existing, pack)).toBe(existing);
  });

  it("appends versioned docs when generation key changes", () => {
    const existing = [
      doc({
        policyDocumentId: 1,
        documentTypeCode: "CARSCHED",
        filename: "sched-v1.pdf",
        generationKey: "old",
      }),
    ];
    const pack = [
      doc({
        policyDocumentId: 0,
        documentTypeCode: "CARSCHED",
        filename: "sched-v2.pdf",
        generationKey: "new",
      }),
      doc({
        policyDocumentId: 0,
        documentTypeCode: "CARRATING",
        filename: "roa-v1.pdf",
        generationKey: "new",
      }),
    ];
    const merged = mergeReviewDocuments(existing, pack);
    expect(merged).toHaveLength(3);
    expect(merged[0]?.filename).toBe("sched-v1.pdf");
    expect(merged[1]?.filename).toBe("sched-v2.pdf");
    expect(merged[1]?.policyDocumentId).toBe(2);
    expect(merged[2]?.documentTypeCode).toBe("CARRATING");
  });

  it("adds missing fixed library docs without replacing versioned pack", () => {
    const existing = [
      doc({
        policyDocumentId: 1,
        documentTypeCode: "CARSCHED",
        filename: "sched.pdf",
        generationKey: "same",
      }),
    ];
    const pack = [
      doc({
        policyDocumentId: 0,
        documentTypeCode: "CARSCHED",
        filename: "sched.pdf",
        generationKey: "same",
      }),
      doc({
        policyDocumentId: 0,
        documentTypeCode: "CARADDIT",
        filename: "wording.pdf",
        generationKey: "same",
      }),
    ];
    const merged = mergeReviewDocuments(existing, pack);
    expect(merged).toHaveLength(2);
    expect(merged[1]?.documentTypeCode).toBe("CARADDIT");
    expect(merged[1]?.filename).toBe("wording.pdf");
  });
});
