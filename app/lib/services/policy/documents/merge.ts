import type { PolicyDocument, PolicyDocumentTypeCode } from "~/lib/db/types";
import { nextDocumentId } from "~/lib/services/policy/documents/content";

/** Generated from policy inputs — new versions are appended, never replaced. */
const VERSIONED_DOCUMENT_CODES = new Set<PolicyDocumentTypeCode>([
  "CARSCHED",
  "CARRATING",
  "CARADJUST",
]);

function isVersionedDocument(doc: PolicyDocument) {
  return VERSIONED_DOCUMENT_CODES.has(doc.documentTypeCode);
}

function isFixedDocument(doc: PolicyDocument) {
  return doc.documentTypeCode === "CARADDIT";
}

/**
 * Merge a new Review pack into existing documents:
 * - Versioned docs (Schedule, ROA, Adjustment): append new versions when the
 *   fingerprint changed — previous files are kept with unique names
 * - Fixed library docs (CARADDIT): keep forever; only add ones still missing
 */
export function mergeReviewDocuments(
  existing: PolicyDocument[] | undefined,
  pack: PolicyDocument[],
): PolicyDocument[] {
  const current = existing ?? [];
  const key = pack[0]?.generationKey;
  const versionedIncoming = pack.filter(isVersionedDocument);
  const fixedIncoming = pack.filter(isFixedDocument);

  const versionedUpToDate =
    Boolean(key) &&
    versionedIncoming.length > 0 &&
    versionedIncoming.every((incoming) =>
      current.some(
        (doc) =>
          isVersionedDocument(doc) &&
          doc.documentTypeCode === incoming.documentTypeCode &&
          doc.generationKey === key,
      ),
    );

  const existingFixedFilenames = new Set(
    current.filter(isFixedDocument).map((doc) => doc.filename),
  );
  const missingFixed = fixedIncoming.filter(
    (doc) => !existingFixedFilenames.has(doc.filename),
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

  // Keep every previous document; append new versions and any missing fixed files.
  return [...current, ...appendedVersioned, ...addedFixed];
}
