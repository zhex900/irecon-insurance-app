import { describe, expect, it } from "vitest";

import { sanitizePolicyDocumentForDb } from "~/lib/services/policy/documents/persist.server";
import { policyDocumentObjectKey } from "~/lib/storage/policy-documents.server";

describe("policyDocumentObjectKey", () => {
  it("scopes objects under policy and document id", () => {
    expect(
      policyDocumentObjectKey(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "schedule.pdf",
      ),
    ).toBe(
      "policies/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222-schedule.pdf",
    );
  });
});

describe("sanitizePolicyDocumentForDb", () => {
  it("clears template doc blobs and content", () => {
    expect(
      sanitizePolicyDocumentForDb({
        policyId: "p1",
        name: "Schedule",
        filename: "sched.pdf",
        generationKey: "gen",
        content: "long summary",
        templateKey: "schedule-annual",
        generatedWhen: new Date().toISOString(),
        generatedBy: "test",
      }),
    ).toEqual({
      policyId: "p1",
      name: "Schedule",
      filename: "sched.pdf",
      generationKey: "gen",
      content: "",
      templateKey: "schedule-annual",
      generatedWhen: expect.any(String),
      generatedBy: "test",
    });
  });

  it("keeps short fallback content for non-template docs", () => {
    const content = "x".repeat(3_000);
    expect(
      sanitizePolicyDocumentForDb({
        policyId: "p1",
        name: "Legacy",
        filename: "legacy.pdf",
        generationKey: "legacy:1",
        content,
        generatedWhen: new Date().toISOString(),
        generatedBy: "test",
      }).content,
    ).toHaveLength(2_000);
  });
});
