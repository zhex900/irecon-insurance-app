import type { PolicyDocument } from "~/lib/db/types";
import { nextDocumentId } from "~/lib/services/policy/documents/content";

function isVersionedDocument(doc: PolicyDocument) {
  return Boolean(doc.templateKey);
}

function isFixedDocument(doc: PolicyDocument) {
  return (
    doc.libraryDocumentId != null || (!doc.templateKey && Boolean(doc.filename))
  );
}

function versionIdentity(doc: PolicyDocument) {
  return doc.templateKey ?? doc.filename;
}

/** Match library docs by id and/or filename so fallbacks don't duplicate API rows. */
function fixedIdentities(doc: PolicyDocument): string[] {
  const keys: string[] = [];
  if (doc.libraryDocumentId != null) {
    keys.push(`id:${doc.libraryDocumentId}`);
  }
  if (doc.filename) {
    keys.push(`file:${doc.filename.trim().toLowerCase()}`);
  }
  return keys;
}

/**
 * Merge a new Review pack into existing documents:
 * - Template-generated docs: append new versions when the fingerprint changed
 * - Library docs: keep forever; only add ones still missing
 */
export function mergeReviewDocuments(
  existing: PolicyDocument[] | undefined,
  pack: PolicyDocument[],
): PolicyDocument[] {
  const current = existing ?? [];
  const key = pack[0]?.generationKey;
  const versionedIncoming = pack.filter(isVersionedDocument);
  const fixedIncoming = pack.filter(
    (doc) => isFixedDocument(doc) && !isVersionedDocument(doc),
  );

  const versionedUpToDate =
    Boolean(key) &&
    versionedIncoming.length > 0 &&
    versionedIncoming.every((incoming) =>
      current.some(
        (doc) =>
          isVersionedDocument(doc) &&
          versionIdentity(doc) === versionIdentity(incoming) &&
          doc.generationKey === key,
      ),
    );

  const existingFixedKeys = new Set(
    current
      .filter((doc) => isFixedDocument(doc) && !isVersionedDocument(doc))
      .flatMap(fixedIdentities),
  );
  const missingFixed = fixedIncoming.filter((doc) =>
    fixedIdentities(doc).every((identity) => !existingFixedKeys.has(identity)),
  );

  if (versionedUpToDate && missingFixed.length === 0) {
    return current;
  }

  let id = nextDocumentId(current);

  const appendedVersioned = versionedUpToDate
    ? []
    : versionedIncoming.map((doc) => ({
        ...doc,
        policyDocumentId: id++,
      }));

  const addedFixed = missingFixed.map((doc) => ({
    ...doc,
    policyDocumentId: id++,
  }));

  return [...current, ...appendedVersioned, ...addedFixed];
}
