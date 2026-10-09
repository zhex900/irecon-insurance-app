import { describe, expect, it } from "vitest";

import {
  buildLegacyDocumentR2TailIndex,
  isLegacyDocumentInR2,
  parseAwsS3LsLine,
} from "../../scripts/db/legacy/lib/legacy-document-r2.mts";

describe("legacy document R2 listing", () => {
  it("parseAwsS3LsLine keeps keys with spaces in filenames", () => {
    const line =
      "2026-08-20 13:39:14      96394 policies/2e42afac-e1f4-4d75-a07c-4269f3c61030/52597-CAR_Schedule_ATCCWI0369_0_20260513 104753.pdf";
    expect(parseAwsS3LsLine(line)).toBe(
      "policies/2e42afac-e1f4-4d75-a07c-4269f3c61030/52597-CAR_Schedule_ATCCWI0369_0_20260513 104753.pdf",
    );
  });

  it("isLegacyDocumentInR2 matches full key or legacy tail", () => {
    const fullKeys = new Set([
      "policies/uuid/52597-CAR_Schedule_ATCCWI0369_0_20260513 104753.pdf",
    ]);
    const tailKeys = buildLegacyDocumentR2TailIndex(fullKeys);
    const doc = {
      policyDocumentId: 52597,
      filename: "CAR_Schedule_ATCCWI0369_0_20260513 104753.pdf",
    };
    expect(
      isLegacyDocumentInR2(
        "policies/other-uuid/52597-CAR_Schedule_ATCCWI0369_0_20260513 104753.pdf",
        doc,
        fullKeys,
        tailKeys,
      ),
    ).toBe(true);
  });
});
