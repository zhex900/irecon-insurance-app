import type { Policy } from "~/lib/db/types";
import type { LibraryDocumentRecord } from "~/lib/library-documents";
import { resolveLibraryAttachments } from "~/lib/services/policy/documents/packs";

/** Display names for documents that Submit will generate (confirmation UI). */
export function listReviewDocumentsForConfirm(
  policy: Policy,
  libraryDocs?: LibraryDocumentRecord[],
): string[] {
  const names = ["CAR Schedule", "CAR Rating / ROA"];
  for (const item of resolveLibraryAttachments(policy, libraryDocs)) {
    names.push(item.name);
  }
  return names;
}
