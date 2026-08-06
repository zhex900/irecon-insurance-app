/** Server-safe policy document exports (no window/fetch). */

export {
  reviewDocumentsFingerprint,
  adjustmentDocumentsFingerprint,
} from "~/lib/services/policy/documents/fingerprints";
export {
  buildReviewDocumentPack,
  buildAdjustmentDocumentPack,
  policyHasLibraryDocuments,
  resolveLibraryAttachments,
  syncPolicyDocumentLabels,
} from "~/lib/services/policy/documents/packs";
export {
  mergeReviewDocuments,
  reviewPackTemplateSetChanged,
  isPreservedAcrossCoverReplace,
} from "~/lib/services/policy/documents/merge";
export { listReviewDocumentsForConfirm } from "~/lib/services/policy/documents/confirm";
