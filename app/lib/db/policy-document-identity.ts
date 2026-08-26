/** Stable document identity for merge/version keys — safe for client bundles. */
export function policyDocumentIdentityKey(doc: {
  templateKey?: string | null;
  libraryDocumentId?: number | null;
  filename: string;
  generationKey: string;
}): string {
  let identity: string;
  if (doc.templateKey) {
    identity = `template:${doc.templateKey}`;
  } else if (doc.libraryDocumentId != null) {
    identity = `library:${doc.libraryDocumentId}`;
  } else {
    identity = `fixed:${doc.filename.trim().toLowerCase()}`;
  }
  return `${identity}|${doc.generationKey}`;
}
