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

/** Premium Excel / adjustment history survive cover-type pack replacement. */
export function isPreservedAcrossCoverReplace(doc: PolicyDocument): boolean {
  if (doc.templateKey === "premium-breakdown-xlsx") return true;
  if (doc.templateKey === "adjustment") return true;
  if (/\.xlsx$/i.test(doc.filename)) return true;
  return false;
}

/**
 * True when existing review templates don't match the pack for the current cover
 * (e.g. Annual → Owner Builder). Empty existing = first generation, not a replace.
 */
export function reviewPackTemplateSetChanged(
  existing: PolicyDocument[] | undefined,
  packTemplateKeys: Iterable<string>,
): boolean {
  const current = existing ?? [];
  const existingKeys = new Set(
    current
      .filter(
        (doc) =>
          isVersionedDocument(doc) && !isPreservedAcrossCoverReplace(doc),
      )
      .map((doc) => doc.templateKey as string),
  );
  if (existingKeys.size === 0) return false;

  const nextKeys = new Set(packTemplateKeys);
  if (existingKeys.size !== nextKeys.size) return true;
  for (const key of nextKeys) {
    if (!existingKeys.has(key)) return true;
  }
  return false;
}

/**
 * Merge a new Review pack into existing documents:
 * - Template-generated docs: append new versions when the fingerprint changed
 * - Library docs: keep forever; only add ones still missing
 * - When `replace` (cover type changed): drop prior review/library pack, keep
 *   Excel/adjustment, then write the new pack as the sole review set.
 */
export function mergeReviewDocuments(
  existing: PolicyDocument[] | undefined,
  pack: PolicyDocument[],
  options?: { replace?: boolean },
): PolicyDocument[] {
  const current = existing ?? [];

  if (options?.replace) {
    const kept = current.filter(isPreservedAcrossCoverReplace);
    let id = nextDocumentId(kept);
    const replaced = pack.map((doc) => ({
      ...doc,
      policyDocumentId: id++,
    }));
    return [...kept, ...replaced];
  }

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
