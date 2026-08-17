import { describe, expect, it } from "vitest";

import type { PolicyDocument } from "~/lib/db/types";
import { versionPolicyDocuments } from "~/lib/services/policy/documents/versions";

function document(
  id: number,
  generatedWhen: string,
  templateKey = "schedule",
): PolicyDocument {
  return {
    policyDocumentId: id,
    policyId: 1,
    name: "Schedule",
    filename: `schedule-${id}.pdf`,
    generationKey: `key-${id}`,
    content: "",
    templateKey,
    generatedWhen,
    generatedBy: "test",
  };
}

describe("policy document versions", () => {
  it("uses generation time rather than implementation ids for latest version", () => {
    const rows = versionPolicyDocuments([
      document(99, "2026-08-04T00:00:00.000Z"),
      document(2, "2026-08-05T00:00:00.000Z"),
    ]);

    expect(
      rows.map(({ doc, version, isLatest }) => ({
        id: doc.policyDocumentId,
        version,
        isLatest,
      })),
    ).toEqual([
      { id: 2, version: 2, isLatest: true },
      { id: 99, version: 1, isLatest: false },
    ]);
  });

  it("versions each template independently", () => {
    const rows = versionPolicyDocuments([
      document(1, "2026-08-04T00:00:00.000Z", "schedule"),
      document(2, "2026-08-05T00:00:00.000Z", "schedule"),
      document(3, "2026-08-03T00:00:00.000Z", "roa"),
    ]);

    expect(rows.find((row) => row.doc.policyDocumentId === 2)?.version).toBe(2);
    expect(rows.find((row) => row.doc.policyDocumentId === 3)?.version).toBe(1);
  });
});
