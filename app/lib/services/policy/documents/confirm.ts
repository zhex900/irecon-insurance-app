import type { Policy } from "~/lib/db/types";
import type { LibraryDocumentRecord } from "~/lib/documents/library-documents";
import {
  policyHasLibraryDocuments,
  resolveLibraryAttachments,
} from "~/lib/services/policy/documents/packs";

/** Display names for documents that Submit will generate (confirmation UI). */
export function listReviewDocumentsForConfirm(
  policy: Policy,
  libraryDocs?: LibraryDocumentRecord[],
): string[] {
  const names = ["CAR Schedule", "CAR Rating / ROA"];
  // Library / static docs only attach on the first review pack.
  if (!policyHasLibraryDocuments(policy.documents)) {
    for (const item of resolveLibraryAttachments(policy, libraryDocs)) {
      names.push(item.name);
    }
  }
  return names;
}
