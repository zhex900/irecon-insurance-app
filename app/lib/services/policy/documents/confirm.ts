import type { Policy } from "~/lib/db/types";
import { formatDocumentLabel } from "~/lib/documents/document-label";
import type { LibraryDocumentRecord } from "~/lib/documents/library-documents";
import {
  type PackTemplateMeta,
  resolveLibraryAttachments,
} from "~/lib/services/policy/documents/packs";

function packTemplateLabel(template: PackTemplateMeta): string {
  return (
    formatDocumentLabel(template.label) ||
    formatDocumentLabel(template.title) ||
    template.key
  );
}

/**
 * Display names for documents Submit will generate (confirmation UI).
 * Prefer published template `label` (then title) for the current cover, plus
 * library attachments that match the policy cover / state.
 */
export function listReviewDocumentsForConfirm(
  policy: Policy,
  options?: {
    libraryDocs?: LibraryDocumentRecord[];
    templates?: PackTemplateMeta[];
  },
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  function push(name: string) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    names.push(trimmed);
  }

  for (const template of options?.templates ?? []) {
    push(packTemplateLabel(template));
  }

  for (const item of resolveLibraryAttachments(policy, options?.libraryDocs)) {
    push(item.name);
  }

  return names;
}
