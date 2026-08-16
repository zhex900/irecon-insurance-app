import { z } from "zod";
import { requireAuth } from "~/lib/auth/session/server.server";
import { ExternalServiceError } from "~/lib/errors";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { parseUuid } from "~/lib/http/route-input";
import {
  getPdfService,
  getLibraryDocumentsBucket,
} from "~/lib/cloudflare.server";
import { EMAIL_SEND_RECIPIENTS } from "~/lib/email/templates";
import { PdfRenderServiceError } from "~/lib/pdf/pdf-worker.server";
import { logger } from "~/lib/observability/logger.server";
import { writeAuditLog } from "~/lib/services/audit/service";
import { sendPolicyDocumentsEmail } from "~/lib/services/email/send-policy-documents.server";
import { getPolicy } from "~/lib/services/policy/data.service";
import type { Route } from "./+types/policies.$policyId.email-documents";

const extraAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentBase64: z.string().min(1).max(12_000_000),
  contentType: z.string().trim().min(1).max(128).optional(),
});

const emailDocumentsBodySchema = z.object({
  documentIds: z.array(z.number().finite()).max(50).optional().default([]),
  extraAttachments: z
    .array(extraAttachmentSchema)
    .max(10)
    .optional()
    .default([]),
  to: z.string().trim().min(1),
  cc: z.string().trim().optional(),
  subject: z.string().trim().min(1),
  body: z.string().optional().default(""),
  html: z.string().optional(),
  recipientType: z.enum(EMAIL_SEND_RECIPIENTS),
});

/**
 * Send selected policy documents via Resend.
 * POST /api/policies/:policyId/email-documents
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const actor = await requireAuth(request);
  const policyId = parseUuid(params.policyId);
  if (!policyId) {
    return Response.json({ error: "Invalid policy id." }, { status: 400 });
  }

  const policy = await getPolicy(policyId);
  if (!policy) {
    return Response.json({ error: "Policy not found" }, { status: 404 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = emailDocumentsBodySchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn("Invalid email documents request", {
      operation: "policy_documents_email_validate",
      issues: JSON.stringify(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          code: issue.code,
        })),
      ),
    });
    return Response.json({ error: "Invalid email request." }, { status: 400 });
  }

  const payload = parsed.data;
  const documents = (policy.documents ?? []).filter((doc) =>
    payload.documentIds.includes(doc.policyDocumentId),
  );
  if (documents.length === 0 && payload.extraAttachments.length === 0) {
    return Response.json(
      { error: "Attach at least one document." },
      { status: 400 },
    );
  }

  try {
    const libraryBucket = getLibraryDocumentsBucket(context);
    const pdfService = getPdfService(context);
    if (!pdfService) {
      return Response.json(
        { error: "Document generation is temporarily unavailable." },
        { status: 503 },
      );
    }
    const sent = await sendPolicyDocumentsEmail({
      policy,
      documents,
      extraAttachments: payload.extraAttachments,
      to: payload.to,
      cc: payload.cc || undefined,
      subject: payload.subject,
      body: payload.body,
      html: payload.html?.trim() || undefined,
      recipientType: payload.recipientType,
      libraryBucket,
      pdfService,
    });

    const attachmentCount = documents.length + payload.extraAttachments.length;

    await writeAuditLog({
      actor,
      action: "policy.documents_email",
      entityType: "policy",
      entityId: policyId,
      summary: `Emailed ${attachmentCount} document${attachmentCount === 1 ? "" : "s"} for ${policy.policyNumber} to ${payload.recipientType} (${payload.to})`,
      metadata: {
        recipientType: payload.recipientType,
        to: payload.to,
        cc: payload.cc || undefined,
        attachmentNames: sent.attachmentNames,
        attachmentBytes: sent.attachmentBytes,
        extraAttachmentCount: payload.extraAttachments.length,
        resendId: sent.resendId,
      },
      request,
    });

    return Response.json({
      ok: true,
      resendId: sent.resendId,
      attachmentCount,
    });
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message : "";
    const message = publicErrorMessage(error, {
      fallback: "Could not send email.",
      operation: "policy_documents_email_send",
    });
    const status =
      error instanceof PdfRenderServiceError ||
      error instanceof ExternalServiceError ||
      /not set|RESEND|EMAIL_FROM/i.test(internalMessage)
        ? 503
        : 400;
    return Response.json({ error: message }, { status });
  }
}
