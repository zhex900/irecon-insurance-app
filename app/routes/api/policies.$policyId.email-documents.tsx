import { requireAuth } from "~/lib/auth/session.server";
import { getLibraryDocumentsBucket } from "~/lib/cloudflare.server";
import type { EmailRecipientType } from "~/lib/email-templates";
import { EMAIL_RECIPIENT_TYPES } from "~/lib/email-templates";
import { writeAuditLog } from "~/lib/services/audit/service";
import { sendPolicyDocumentsEmail } from "~/lib/services/email/send-policy-documents.server";
import { getPolicy } from "~/lib/services/policy/data.service";
import type { Route } from "./+types/policies.$policyId.email-documents";

type EmailDocumentsBody = {
  documentIds?: number[];
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  recipientType?: string;
};

/**
 * Send selected policy documents via Resend.
 * POST /api/policies/:policyId/email-documents
 */
export async function action({ request, params, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const actor = await requireAuth(request);
  const policyId = Number(params.policyId);
  if (!Number.isFinite(policyId) || policyId <= 0) {
    return Response.json({ error: "Invalid policy id" }, { status: 400 });
  }

  const policy = await getPolicy(policyId);
  if (!policy) {
    return Response.json({ error: "Policy not found" }, { status: 404 });
  }

  const payload = (await request.json()) as EmailDocumentsBody;
  const recipientType = String(payload.recipientType ?? "").trim();
  if (!EMAIL_RECIPIENT_TYPES.includes(recipientType as EmailRecipientType)) {
    return Response.json({ error: "Invalid recipient type" }, { status: 400 });
  }

  const documentIds = Array.isArray(payload.documentIds)
    ? payload.documentIds.map(Number).filter((id) => Number.isFinite(id))
    : [];
  const documents = (policy.documents ?? []).filter((doc) =>
    documentIds.includes(doc.policyDocumentId),
  );
  if (documents.length === 0) {
    return Response.json(
      { error: "Attach at least one document." },
      { status: 400 },
    );
  }

  const to = String(payload.to ?? "").trim();
  const subject = String(payload.subject ?? "").trim();
  const body = String(payload.body ?? "");
  if (!to) {
    return Response.json(
      { error: "Enter at least one recipient email." },
      { status: 400 },
    );
  }
  if (!subject) {
    return Response.json({ error: "Subject is required." }, { status: 400 });
  }

  try {
    const libraryBucket = getLibraryDocumentsBucket(context);
    const sent = await sendPolicyDocumentsEmail({
      policy,
      documents,
      to,
      cc: String(payload.cc ?? "").trim() || undefined,
      subject,
      body,
      recipientType: recipientType as EmailRecipientType,
      libraryBucket,
    });

    await writeAuditLog({
      actor,
      action: "policy.documents_email",
      entityType: "policy",
      entityId: policyId,
      summary: `Emailed ${documents.length} document${documents.length === 1 ? "" : "s"} for ${policy.policyNumber} to ${recipientType} (${to})`,
      metadata: {
        recipientType,
        to,
        cc: String(payload.cc ?? "").trim() || undefined,
        attachmentNames: sent.attachmentNames,
        attachmentBytes: sent.attachmentBytes,
        resendId: sent.resendId,
      },
      request,
    });

    return Response.json({
      ok: true,
      resendId: sent.resendId,
      attachmentCount: documents.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send email.";
    const status = /not set|RESEND|EMAIL_FROM/i.test(message) ? 503 : 400;
    return Response.json({ error: message }, { status });
  }
}
