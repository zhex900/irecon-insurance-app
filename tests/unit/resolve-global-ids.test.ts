import { describe, expect, it } from "vitest";

describe("resolve global child row ids", () => {
  it("remaps ids that collide with globally used values", async () => {
    const used = new Set([1, 2, 3, 4, 5]);
    let nextId = 6;
    const batchUsed = new Set<number>();

    const rows = [1, 2, 3, 4, 5].map((id) => ({ policyDocumentId: id }));
    const remapped = rows.map((row) => {
      let id = row.policyDocumentId;
      if (id <= 0 || used.has(id) || batchUsed.has(id)) {
        while (used.has(nextId) || batchUsed.has(nextId)) nextId += 1;
        id = nextId;
        nextId += 1;
      }
      batchUsed.add(id);
      return { ...row, policyDocumentId: id };
    });

    expect(remapped.map((row) => row.policyDocumentId)).toEqual([
      6, 7, 8, 9, 10,
    ]);
  });

  it("keeps ids that are globally unused", async () => {
    const used = new Set([1, 2]);
    let nextId = 3;
    const batchUsed = new Set<number>();

    const rows = [{ policyDocumentId: 99 }, { policyDocumentId: 100 }];
    const remapped = rows.map((row) => {
      let id = row.policyDocumentId;
      if (id <= 0 || used.has(id) || batchUsed.has(id)) {
        while (used.has(nextId) || batchUsed.has(nextId)) nextId += 1;
        id = nextId;
        nextId += 1;
      }
      batchUsed.add(id);
      return { ...row, policyDocumentId: id };
    });

    expect(remapped.map((row) => row.policyDocumentId)).toEqual([99, 100]);
  });
});
