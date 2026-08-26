import { randomUUID } from "node:crypto";

import { policyDocumentIdentityKey } from "~/lib/db/policy-document-identity";
import type { policyDocument, policyNote } from "~/lib/db/schema";
import { parseUuid } from "~/lib/http/route-input";

type DocumentInsert = typeof policyDocument.$inferInsert;
type NoteInsert = typeof policyNote.$inferInsert;

type ExistingDocument = {
  documentId: string;
  templateKey: string | null;
  libraryDocumentId: number | null;
  filename: string;
  generationKey: string;
};

type ExistingNote = Pick<NoteInsert, "noteId">;

/** Assign stable UUIDs before re-insert (snapshot taken before delete). */
export function assignPolicyDocumentIds(
  existing: ExistingDocument[],
  rows: DocumentInsert[],
): DocumentInsert[] {
  if (rows.length === 0) return rows;

  const byId = new Map(existing.map((row) => [row.documentId, row]));
  const byIdentity = new Map(
    existing.map((row) => [policyDocumentIdentityKey(row), row.documentId]),
  );
  const byGenerationKey = new Map(
    existing.map((row) => [row.generationKey, row.documentId]),
  );
  const batchUsed = new Set<string>();

  return rows.map((row) => {
    let documentId: string | undefined;

    const identityInput = {
      templateKey: row.templateKey,
      libraryDocumentId: row.libraryDocumentId,
      filename: row.filename ?? "",
      generationKey: row.generationKey ?? "",
    };

    const incomingId = parseUuid(row.documentId);
    if (incomingId && byId.has(incomingId)) {
      documentId = incomingId;
    } else {
      documentId = byIdentity.get(policyDocumentIdentityKey(identityInput));
      if (
        !documentId &&
        row.generationKey &&
        /^legacy:\d+$/.test(row.generationKey)
      ) {
        documentId = byGenerationKey.get(row.generationKey);
      }
    }

    if (!documentId || batchUsed.has(documentId)) {
      documentId = randomUUID();
    }
    batchUsed.add(documentId);
    return { ...row, documentId };
  });
}

/** Preserve note UUIDs when the client round-trips an existing row. */
export function assignPolicyNoteIds(
  existing: ExistingNote[],
  rows: NoteInsert[],
): NoteInsert[] {
  if (rows.length === 0) return rows;

  const known = new Set(existing.map((row) => row.noteId));
  const batchUsed = new Set<string>();

  return rows.map((row) => {
    const incomingId = parseUuid(row.noteId);
    let noteId =
      incomingId && known.has(incomingId) ? incomingId : randomUUID();
    if (batchUsed.has(noteId)) {
      noteId = randomUUID();
    }
    batchUsed.add(noteId);
    return { ...row, noteId };
  });
}
