import type { R2BucketLike } from "~/lib/cloudflare.server";
import type { Policy, PolicyDocument } from "~/lib/db/types";
import type { EmailSendRecipient } from "~/lib/email-templates";
import { generatePolicyPdf, uint8ToBase64 } from "~/lib/pdf/generate";
import { buildLegacyTextPdfBlob } from "~/lib/pdf/legacy-text-pdf";
import { resolvePublishedPdfTemplate } from "~/lib/services/documents/document-templates";
import {
  getLibraryDocumentByFilename,
  getLibraryDocumentById,
} from "~/lib/services/documents/library-documents";
import { getLibraryDocumentObject } from "~/lib/storage/library-documents.server";
import {
  sendEmail,
  type SendEmailAttachment,
} from "~/lib/services/email/resend.server";

/** Soft cap before we refuse oversized packs (Resend limit is 40MB encoded). */
const MAX_ATTACHMENTS_BYTES = 12 * 1024 * 1024;

export type SendPolicyDocumentsInput = {
  policy: Policy;
  documents: PolicyDocument[];
  to: string;
  cc?: string;
  subject: string;
  /** Plain-text body (and legacy HTML-escaped fallback when `html` omitted). */
  body: string;
  /** Email-ready HTML from React Email editor export. */
  html?: string;
  recipientType: EmailSendRecipient;
  libraryBucket?: R2BucketLike | null;
};

export type SendPolicyDocumentsResult = {
  resendId: string;
  attachmentNames: string[];
  attachmentBytes: number;
};

function splitEmails(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function plainTextToHtml(text: string) {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return `<div style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escaped}</div>`;
}

function looksLikeHtml(value: string) {
  return /<[a-z][\s\S]*>/i.test(value.trim());
}

async function blobToUint8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

async function resolveDocumentPdfBytes(
  doc: PolicyDocument,
  policy: Policy,
  libraryBucket?: R2BucketLike | null,
): Promise<Uint8Array> {
  if (!doc.templateKey) {
    if (libraryBucket) {
      const libraryDoc =
        doc.libraryDocumentId != null
          ? await getLibraryDocumentById(doc.libraryDocumentId)
          : await getLibraryDocumentByFilename(doc.filename);
      if (libraryDoc) {
        const object = await getLibraryDocumentObject(
          libraryBucket,
          libraryDoc.r2Key,
        );
        if (object?.body) {
          return new Uint8Array(await new Response(object.body).arrayBuffer());
        }
      }
    }
    return blobToUint8(await buildLegacyTextPdfBlob(doc.name, doc.content));
  }

  if (doc.pdfBase64) {
    const binary = atob(doc.pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  const slot = await resolvePublishedPdfTemplate(doc.templateKey);
  if (!slot) {
    return blobToUint8(await buildLegacyTextPdfBlob(doc.name, doc.content));
  }

  try {
    const { pdf } = await generatePolicyPdf(
      doc.templateKey,
      policy,
      doc.mergeInputs,
      slot,
    );
    return pdf;
  } catch {
    return blobToUint8(await buildLegacyTextPdfBlob(doc.name, doc.content));
  }
}

/**
 * Build PDF attachments and send via Resend.
 * Policy PDFs are attached (typically small). Prefer signed R2 links later for very large packs.
 */
export async function sendPolicyDocumentsEmail(
  input: SendPolicyDocumentsInput,
): Promise<SendPolicyDocumentsResult> {
  const toList = splitEmails(input.to);
  if (toList.length === 0) {
    throw new Error("Enter at least one recipient email.");
  }
  if (input.documents.length === 0) {
    throw new Error("Attach at least one document.");
  }

  const attachments: SendEmailAttachment[] = [];
  let totalBytes = 0;

  for (const doc of input.documents) {
    const bytes = await resolveDocumentPdfBytes(
      doc,
      input.policy,
      input.libraryBucket,
    );
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_ATTACHMENTS_BYTES) {
      throw new Error(
        "Selected documents are too large to email as attachments. Select fewer files and try again.",
      );
    }
    attachments.push({
      filename: doc.filename.endsWith(".pdf")
        ? doc.filename
        : `${doc.filename}.pdf`,
      content: uint8ToBase64(bytes),
      contentType: "application/pdf",
    });
  }

  const ccList = input.cc ? splitEmails(input.cc) : [];
  const html =
    input.html?.trim() ||
    (looksLikeHtml(input.body) ? input.body : plainTextToHtml(input.body));
  const text = looksLikeHtml(input.body)
    ? input.body
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replaceAll("&nbsp;", " ")
        .trim() || input.body
    : input.body;

  const result = await sendEmail({
    to: toList,
    cc: ccList.length > 0 ? ccList : undefined,
    subject: input.subject.trim(),
    text,
    html,
    attachments,
    tags: [
      { name: "policy_id", value: String(input.policy.policyId) },
      { name: "recipient_type", value: input.recipientType },
    ],
  });

  return {
    resendId: result.id,
    attachmentNames: attachments.map((file) => file.filename),
    attachmentBytes: totalBytes,
  };
}
