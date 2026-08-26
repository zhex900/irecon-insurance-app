import { describe, expect, it } from "vitest";

import type { PolicyDocument } from "~/lib/db/types";
import { versionPolicyDocuments } from "~/lib/services/policy/documents/versions";

function document(
  documentId: string,
  generatedWhen: string,
  templateKey = "schedule",
): PolicyDocument {
  return {
    documentId,
    policyId: "policy-1",
    name: "Schedule",
    filename: `schedule-${documentId.slice(0, 8)}.pdf`,
    generationKey: `key-${documentId}`,
    content: "",
    templateKey,
    generatedWhen,
    generatedBy: "test",
  };
}

describe("policy document versions", () => {
  it("uses generation time rather than ids for latest version", () => {
    const rows = versionPolicyDocuments([
      document("11111111-1111-4111-8111-111111111111", "2026-08-04T00:00:00.000Z"),
      document("22222222-2222-4222-8222-222222222222", "2026-08-05T00:00:00.000Z"),
    ]);

    expect(
      rows.map(({ doc, version, isLatest }) => ({
        id: doc.documentId,
        version,
        isLatest,
      })),
    ).toEqual([
      {
        id: "22222222-2222-4222-8222-222222222222",
        version: 2,
        isLatest: true,
      },
      {
        id: "11111111-1111-4111-8111-111111111111",
        version: 1,
        isLatest: false,
      },
    ]);
  });

  it("versions each template independently", () => {
    const rows = versionPolicyDocuments([
      document("11111111-1111-4111-8111-111111111111", "2026-08-04T00:00:00.000Z", "schedule"),
      document("22222222-2222-4222-8222-222222222222", "2026-08-05T00:00:00.000Z", "schedule"),
      document("33333333-3333-4333-8333-333333333333", "2026-08-03T00:00:00.000Z", "roa"),
    ]);

    expect(rows.find((row) => row.doc.documentId === "22222222-2222-4222-8222-222222222222")?.version).toBe(2);
    expect(rows.find((row) => row.doc.documentId === "33333333-3333-4333-8333-333333333333")?.version).toBe(1);
  });
});
