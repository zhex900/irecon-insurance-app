import { describe, expect, it } from "vitest";

import type { PolicyDocument } from "~/lib/db/types";
import {
  nextAmendmentNumber,
  nextDocumentId,
} from "~/lib/services/policy/documents/content";
import {
  mergeReviewDocuments,
  reviewPackTemplateSetChanged,
} from "~/lib/services/policy/documents/merge";

function doc(
  partial: Partial<PolicyDocument> &
    Pick<PolicyDocument, "policyDocumentId" | "filename">,
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
          filename: "a.pdf",
          templateKey: "schedule-annual",
        }),
        doc({
          policyDocumentId: 7,
          filename: "b.pdf",
          templateKey: "rating-annual",
        }),
      ]),
    ).toBe(8);
  });

  it("nextAmendmentNumber counts by template key", () => {
    const existing = [
      doc({
        policyDocumentId: 1,
        filename: "s1.pdf",
        templateKey: "schedule-annual",
      }),
      doc({
        policyDocumentId: 2,
        filename: "s2.pdf",
        templateKey: "schedule-annual",
      }),
      doc({
        policyDocumentId: 3,
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
        policyDocumentId: 1,
        filename: "sched.pdf",
        templateKey: "schedule-annual",
        generationKey: "same",
      }),
      doc({
        policyDocumentId: 2,
        filename: "lib.pdf",
        libraryDocumentId: 9,
        generationKey: "same",
      }),
    ];
    const pack = [
      doc({
        policyDocumentId: 99,
        filename: "sched-new.pdf",
        templateKey: "schedule-annual",
        generationKey: "same",
      }),
      doc({
        policyDocumentId: 100,
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
        policyDocumentId: 1,
        filename: "sched-v1.pdf",
        templateKey: "schedule-annual",
        generationKey: "old",
      }),
    ];
    const pack = [
      doc({
        policyDocumentId: 0,
        filename: "sched-v2.pdf",
        templateKey: "schedule-annual",
        generationKey: "new",
      }),
      doc({
        policyDocumentId: 0,
        filename: "roa-v1.pdf",
        templateKey: "rating-annual",
        generationKey: "new",
      }),
    ];
    const merged = mergeReviewDocuments(existing, pack);
    expect(merged).toHaveLength(3);
    expect(merged[0]?.filename).toBe("sched-v1.pdf");
    expect(merged[1]?.filename).toBe("sched-v2.pdf");
    expect(merged[1]?.policyDocumentId).toBe(2);
    expect(merged[2]?.templateKey).toBe("rating-annual");
  });

  it("adds missing fixed library docs without replacing versioned pack", () => {
    const existing = [
      doc({
        policyDocumentId: 1,
        filename: "sched.pdf",
        templateKey: "schedule-annual",
        generationKey: "same",
      }),
    ];
    const pack = [
      doc({
        policyDocumentId: 0,
        filename: "sched.pdf",
        templateKey: "schedule-annual",
        generationKey: "same",
      }),
      doc({
        policyDocumentId: 0,
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
        policyDocumentId: 1,
        filename: "sched-annual.pdf",
        templateKey: "schedule-annual",
        generationKey: "old",
      }),
      doc({
        policyDocumentId: 2,
        filename: "wording-annual.pdf",
        libraryDocumentId: 9,
        generationKey: "old",
      }),
      doc({
        policyDocumentId: 3,
        filename: "premium.xlsx",
        templateKey: "premium-breakdown-xlsx",
        generationKey: "excel",
      }),
    ];
    const pack = [
      doc({
        policyDocumentId: 0,
        filename: "sched-ob.pdf",
        templateKey: "schedule-owner-builder",
        generationKey: "new",
      }),
      doc({
        policyDocumentId: 0,
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
    expect(merged[1]?.policyDocumentId).toBe(4);
  });
});

describe("reviewPackTemplateSetChanged", () => {
  it("detects Annual → Owner Builder template key change", () => {
    expect(
      reviewPackTemplateSetChanged(
        [
          doc({
            policyDocumentId: 1,
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
            policyDocumentId: 1,
            filename: "a.pdf",
            templateKey: "schedule-annual",
          }),
          doc({
            policyDocumentId: 2,
            filename: "b.pdf",
            templateKey: "rating-annual",
          }),
        ],
        ["schedule-annual", "rating-annual"],
      ),
    ).toBe(false);
  });
});
