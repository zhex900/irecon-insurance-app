/** Max length for document labels shown on the policy documents side card. */
export const DOCUMENT_LABEL_MAX_LENGTH = 28;

/** Default label: first characters of the filename (without `.pdf` / `.xlsx`). */
export function documentLabelFromFilename(filename: string): string {
  const base = filename.replace(/\.(pdf|xlsx)$/i, "").trim() || filename.trim();
  return base.slice(0, DOCUMENT_LABEL_MAX_LENGTH);
}

/** Normalize a user-supplied label to at most characters. */
export function normalizeDocumentLabel(
  label: string,
  fallbackFilename?: string,
): string {
  const trimmed = label.trim().slice(0, DOCUMENT_LABEL_MAX_LENGTH);
  if (trimmed) return trimmed;
  if (fallbackFilename) return documentLabelFromFilename(fallbackFilename);
  return "";
}

/** Clamp any stored/display name for the side-card label slot. */
export function formatDocumentLabel(label: string): string {
  return label.trim().slice(0, DOCUMENT_LABEL_MAX_LENGTH);
}
