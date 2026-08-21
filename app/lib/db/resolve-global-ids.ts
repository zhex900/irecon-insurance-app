import { sql } from "drizzle-orm";

import { getDb } from "~/lib/db/client";
import { policyDocument, policyNote } from "~/lib/db/schema";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function loadUsedIds(
  tx: Tx,
  table: typeof policyDocument | typeof policyNote,
  idColumn:
    typeof policyDocument.policyDocumentId | typeof policyNote.policyNoteId,
): Promise<{ used: Set<number>; nextId: number }> {
  const existing = await tx.select({ id: idColumn }).from(table);
  const used = new Set(existing.map((row) => row.id));

  const [maxRow] = await tx
    .select({
      max: sql<number>`coalesce(max(${idColumn}), 0)::bigint`,
    })
    .from(table);

  return { used, nextId: Number(maxRow?.max ?? 0) + 1 };
}

function remapIds<T extends Record<string, unknown>>(
  rows: T[],
  idKey: "policyDocumentId" | "policyNoteId",
  used: Set<number>,
  startId: number,
): T[] {
  if (rows.length === 0) return rows;

  let nextId = startId;
  const batchUsed = new Set<number>();

  return rows.map((row) => {
    let id = Number(row[idKey]);
    if (id <= 0 || used.has(id) || batchUsed.has(id)) {
      while (used.has(nextId) || batchUsed.has(nextId)) nextId += 1;
      id = nextId;
      nextId += 1;
    }
    batchUsed.add(id);
    return { ...row, [idKey]: id };
  });
}

/** Legacy MSSQL ids are global; per-policy id counters can collide across policies. */
export async function resolvePolicyDocumentIds(
  tx: Tx,
  rows: Array<typeof policyDocument.$inferInsert>,
): Promise<Array<typeof policyDocument.$inferInsert>> {
  const { used, nextId } = await loadUsedIds(
    tx,
    policyDocument,
    policyDocument.policyDocumentId,
  );
  return remapIds(rows, "policyDocumentId", used, nextId);
}

export async function resolvePolicyNoteIds(
  tx: Tx,
  rows: Array<typeof policyNote.$inferInsert>,
): Promise<Array<typeof policyNote.$inferInsert>> {
  const { used, nextId } = await loadUsedIds(
    tx,
    policyNote,
    policyNote.policyNoteId,
  );
  return remapIds(rows, "policyNoteId", used, nextId);
}
