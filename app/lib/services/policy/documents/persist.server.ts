import type { R2BucketLike } from "~/lib/cloudflare.server";
import type { policyDocument } from "~/lib/db/schema";
import type { Policy, PolicyDocument } from "~/lib/db/types";
import { getRequestContext } from "~/lib/observability/request-context.server";
import type { PdfWorkerBinding } from "~/lib/pdf/pdf-worker.server";
import { renderPolicyPdf } from "~/lib/pdf/pdf-worker.server";
import { resolvePublishedPdfTemplate } from "~/lib/services/documents/document-templates";
import { getCarWording } from "~/lib/services/reference.service";
import {
  policyDocumentObjectKey,
  putPolicyDocumentPdf,
} from "~/lib/storage/policy-documents.server";
import { resolveBrokerFeeLines } from "~/server/pricing/rate-resolver";

type DocumentInsert = typeof policyDocument.$inferInsert;

export type ExistingPolicyDocumentRef = {
  documentId: string;
  generationKey: string;
  r2Key: string | null;
};

const MAX_FALLBACK_CONTENT_LENGTH = 2_000;

/** Strip inline blobs before Postgres — PDF bytes belong in R2 only. */
export function sanitizePolicyDocumentForDb(
  doc: PolicyDocument,
): PolicyDocument {
  const content = doc.templateKey
    ? ""
    : (doc.content ?? "").slice(0, MAX_FALLBACK_CONTENT_LENGTH);
  return {
    ...doc,
    content,
  };
}

function preserveExistingR2Key(
  doc: DocumentInsert,
  existing: ExistingPolicyDocumentRef[],
): DocumentInsert {
  const prev = existing.find((row) => row.documentId === doc.documentId);
  if (prev?.r2Key && prev.generationKey === doc.generationKey) {
    return { ...doc, r2Key: prev.r2Key };
  }
  if (!doc.templateKey && (doc.r2Key ?? prev?.r2Key)) {
    return { ...doc, r2Key: doc.r2Key ?? prev?.r2Key ?? null };
  }
  return doc;
}

async function renderTemplateDocumentPdf(
  policy: Policy,
  doc: DocumentInsert,
  pdfService: PdfWorkerBinding,
): Promise<Uint8Array> {
  if (!doc.templateKey) {
    throw new Error("Template key is required to render a policy document.");
  }
  const resolved = await resolvePublishedPdfTemplate(doc.templateKey);
  if (!resolved) {
    throw new Error(`Published template not found: ${doc.templateKey}`);
  }

  const [wordingCatalogue, brokerFeeLines] = await Promise.all([
    getCarWording(),
    resolveBrokerFeeLines(policy.dateStart),
  ]);

  return renderPolicyPdf(pdfService, {
    contractVersion: 1,
    requestId: getRequestContext()?.requestId ?? crypto.randomUUID(),
    templateKey: doc.templateKey,
    policy,
    template: resolved,
    wordingCatalogue,
    brokerFeeLines,
  });
}

/**
 * Upload PDFs for template documents and attach `r2Key`.
 * Reuses existing keys when `generationKey` is unchanged.
 */
export async function applyPolicyDocumentR2Keys(
  policy: Policy,
  documents: DocumentInsert[],
  existing: ExistingPolicyDocumentRef[],
  options: {
    libraryBucket: R2BucketLike | null;
    pdfService: PdfWorkerBinding;
  },
): Promise<DocumentInsert[]> {
  if (!options.libraryBucket) {
    throw new Error("Document storage is not configured.");
  }

  const next: DocumentInsert[] = [];
  for (const doc of documents) {
    const preserved = preserveExistingR2Key(doc, existing);
    if (preserved.r2Key || !preserved.templateKey) {
      next.push(preserved);
      continue;
    }

    if (!preserved.documentId) {
      throw new Error("Document id is required before uploading to R2.");
    }

    const bytes = await renderTemplateDocumentPdf(
      policy,
      preserved,
      options.pdfService,
    );
    const r2Key = policyDocumentObjectKey(
      policy.policyId,
      preserved.documentId,
      preserved.filename || "document.pdf",
    );
    await putPolicyDocumentPdf(options.libraryBucket, r2Key, bytes);
    next.push({ ...preserved, r2Key });
  }
  return next;
}

/** Keep prior R2 keys when storage bindings are unavailable (draft saves). */
export function preservePolicyDocumentR2Keys(
  documents: DocumentInsert[],
  existing: ExistingPolicyDocumentRef[],
): DocumentInsert[] {
  return documents.map((doc) => preserveExistingR2Key(doc, existing));
}
