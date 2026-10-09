import { describe, expect, it } from "vitest";

import {
  mergeDocumentLocalMatchKey,
  parseMergeDocumentFilename,
} from "../../scripts/db/legacy/lib/legacy-merge-document-filename.mts";

describe("legacy merge document filenames", () => {
  it("parses CAR adjustment names", () => {
    const parsed = parseMergeDocumentFilename(
      "CARADJUST",
      "CAR_Adjustment_ATCCW79318_5_20260914 115350.pdf",
    );
    expect(parsed).toEqual({
      documentTypeCode: "CARADJUST",
      policyNumberSegment: "ATCCW79318",
      amendmentNumber: 5,
      dateYmd: "20260914",
      timeHms: "115350",
    });
  });

  it("matches local files when policy number punctuation differs", () => {
    const keyA = mergeDocumentLocalMatchKey(
      "CARSCHED",
      "CAR_Schedule_ATCCW-79318_0_20250902 114604.pdf",
    );
    const keyB = mergeDocumentLocalMatchKey(
      "CARSCHED",
      "CAR_Schedule_ATCCW79318_0_20250902 114604.pdf",
    );
    expect(keyA).toBe("CARSCHED:0:20250902:114604");
    expect(keyB).toBe(keyA);
  });
});
