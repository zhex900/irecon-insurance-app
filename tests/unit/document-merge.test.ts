import { describe, expect, it } from "vitest";

import type { PolicyDocument } from "~/lib/db/types";
import { nextAmendmentNumber } from "~/lib/services/policy/documents/content";
import {
  mergeReviewDocuments,
  reviewPackTemplateSetChanged,
} from "~/lib/services/policy/documents/merge";

function doc(
  partial: Partial<PolicyDocument> & Pick<PolicyDocument, "filename">,
): PolicyDocument {
  return {
    policyId: "policy-1",
    name: partial.filename,
    generationKey: "gen-a",
    content: "",
    generatedWhen: "2026-01-01T00:00:00.000Z",
    generatedBy: "test",
    ...partial,
  };
}

describe("document helpers", () => {
  it("nextAmendmentNumber counts by template key", () => {
    const existing = [
      doc({
        documentId: "11111111-1111-4111-8111-111111111111",
        filename: "s1.pdf",
        templateKey: "schedule-annual",
      }),
      doc({
        documentId: "22222222-2222-4222-8222-222222222222",
        filename: "s2.pdf",
        templateKey: "schedule-annual",
      }),
      doc({
        documentId: "33333333-3333-4333-8333-333333333333",
        filename: "r1.pdf",
        templateKey: "rating-annual",
      }),
    ];
    expect(nextAmendmentNumber(existing, "schedule-annual")).toBe(2);
    expect(nextAmendmentNumber(existing, "adjustment")).toBe(0);
  });
});

describe("mergeReviewDocuments", () => {
  it("returns current when pack fingerprint already present and fixed docs exist", () => {
    const existing = [
      doc({
        filename: "sched.pdf",
        templateKey: "schedule-annual",
        generationKey: "same",
      }),
      doc({
        filename: "lib.pdf",
        libraryDocumentId: 9,
        generationKey: "same",
      }),
    ];
    const pack = [
      doc({
        filename: "sched-new.pdf",
        templateKey: "schedule-annual",
        generationKey: "same",
      }),
      doc({
        filename: "lib.pdf",
        libraryDocumentId: 9,
        generationKey: "same",
      }),
    ];
    expect(mergeReviewDocuments(existing, pack)).toBe(existing);
  });

  it("appends versioned docs when generation key changes", () => {
    const existing = [
      doc({
        filename: "sched-v1.pdf",
        templateKey: "schedule-annual",
        generationKey: "old",
      }),
    ];
    const pack = [
      doc({
        filename: "sched-v2.pdf",
        templateKey: "schedule-annual",
        generationKey: "new",
      }),
      doc({
        filename: "roa-v1.pdf",
        templateKey: "rating-annual",
        generationKey: "new",
      }),
    ];
    const merged = mergeReviewDocuments(existing, pack);
    expect(merged).toHaveLength(3);
    expect(merged[0]?.filename).toBe("sched-v1.pdf");
    expect(merged[1]?.filename).toBe("sched-v2.pdf");
    expect(merged[2]?.templateKey).toBe("rating-annual");
  });

  it("adds missing fixed library docs without replacing versioned pack", () => {
    const existing = [
      doc({
        filename: "sched.pdf",
        templateKey: "schedule-annual",
        generationKey: "same",
      }),
    ];
    const pack = [
      doc({
        filename: "sched.pdf",
        templateKey: "schedule-annual",
        generationKey: "same",
      }),
      doc({
        filename: "wording.pdf",
        libraryDocumentId: 3,
        generationKey: "same",
      }),
    ];
    const merged = mergeReviewDocuments(existing, pack);
    expect(merged).toHaveLength(2);
    expect(merged[1]?.libraryDocumentId).toBe(3);
    expect(merged[1]?.filename).toBe("wording.pdf");
  });

  it("replace drops prior cover pack and keeps premium excel", () => {
    const existing = [
      doc({
        filename: "sched-annual.pdf",
        templateKey: "schedule-annual",
        generationKey: "old",
      }),
      doc({
        filename: "wording-annual.pdf",
        libraryDocumentId: 9,
        generationKey: "old",
      }),
      doc({
        filename: "premium.xlsx",
        templateKey: "premium-breakdown-xlsx",
        generationKey: "excel",
      }),
    ];
    const pack = [
      doc({
        filename: "sched-ob.pdf",
        templateKey: "schedule-owner-builder",
        generationKey: "new",
      }),
      doc({
        filename: "wording-ob.pdf",
        libraryDocumentId: 11,
        generationKey: "new",
      }),
    ];
    const merged = mergeReviewDocuments(existing, pack, { replace: true });
    expect(merged.map((d) => d.templateKey ?? d.libraryDocumentId)).toEqual([
      "premium-breakdown-xlsx",
      "schedule-owner-builder",
      11,
    ]);
  });
});

describe("reviewPackTemplateSetChanged", () => {
  it("detects Annual → Owner Builder template key change", () => {
    expect(
      reviewPackTemplateSetChanged(
        [
          doc({
            filename: "a.pdf",
            templateKey: "schedule-annual",
          }),
        ],
        ["schedule-owner-builder", "rating-owner-builder"],
      ),
    ).toBe(true);
  });

  it("is false when keys match", () => {
    expect(
      reviewPackTemplateSetChanged(
        [
          doc({
            filename: "a.pdf",
            templateKey: "schedule-annual",
          }),
          doc({
            filename: "b.pdf",
            templateKey: "rating-annual",
          }),
        ],
        ["schedule-annual", "rating-annual"],
      ),
    ).toBe(false);
  });
});
