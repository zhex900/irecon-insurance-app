import type { PolicyDocument } from "~/lib/db/types";

export type VersionedPolicyDocument = {
  doc: PolicyDocument;
  version: number;
  isLatest: boolean;
};

function documentTypeKey(doc: PolicyDocument): string {
  if (doc.templateKey) return `template:${doc.templateKey}`;
  if (doc.libraryDocumentId != null) return `library:${doc.libraryDocumentId}`;
  return `fixed:${doc.filename}`;
}

function generatedTime(doc: PolicyDocument): number {
  const value = Date.parse(doc.generatedWhen);
  return Number.isNaN(value) ? 0 : value;
}

function compareDocumentAge(a: PolicyDocument, b: PolicyDocument): number {
  return (
    generatedTime(a) - generatedTime(b) ||
    a.filename.localeCompare(b.filename) ||
    (a.documentId ?? "").localeCompare(b.documentId ?? "")
  );
}

/** Assign chronological versions per document type and mark its newest row. */
export function versionPolicyDocuments(
  documents: readonly PolicyDocument[],
): VersionedPolicyDocument[] {
  const groups = new Map<string, PolicyDocument[]>();
  for (const doc of documents) {
    const key = documentTypeKey(doc);
    groups.set(key, [...(groups.get(key) ?? []), doc]);
  }

  const rows: VersionedPolicyDocument[] = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort(compareDocumentAge);
    ordered.forEach((doc, index) => {
      rows.push({
        doc,
        version: index + 1,
        isLatest: index === ordered.length - 1,
      });
    });
  }

  return rows.sort((a, b) => compareDocumentAge(b.doc, a.doc));
}
