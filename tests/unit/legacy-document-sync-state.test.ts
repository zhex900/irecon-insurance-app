import { describe, expect, it } from "vitest";

import {
  assertSyncStateCompatible,
  emptySyncState,
  markDocumentCompleted,
  markDocumentMissing,
  syncStateSets,
} from "../../scripts/db/legacy/lib/legacy-document-sync-state.mts";

describe("legacy document sync state", () => {
  it("tracks completed and missing document ids", () => {
    const state = emptySyncState({
      env: "local",
      exportPath: "/tmp/export.json",
    });

    markDocumentCompleted(state, 101);
    markDocumentMissing(state, 202);

    expect(state.completedDocumentIds).toEqual([101]);
    expect(state.missingDocumentIds).toEqual([202]);
    expect(state.stats.uploaded).toBe(1);
    expect(state.stats.missing).toBe(1);

    markDocumentCompleted(state, 202);
    expect(state.missingDocumentIds).toEqual([]);
  });

  it("rejects checkpoint env mismatch", () => {
    const state = emptySyncState({
      env: "uat",
      exportPath: "/tmp/export.json",
    });

    expect(() =>
      assertSyncStateCompatible(state, {
        env: "local",
        exportPath: "/tmp/export.json",
      }),
    ).toThrow(/env=uat/);
  });

  it("builds lookup sets from checkpoint", () => {
    const state = emptySyncState({
      env: "local",
      exportPath: "/tmp/export.json",
    });
    state.completedDocumentIds = [1, 2];
    state.missingDocumentIds = [3];

    const { completed, missing } = syncStateSets(state);
    expect(completed.has(2)).toBe(true);
    expect(missing.has(3)).toBe(true);
  });
});
