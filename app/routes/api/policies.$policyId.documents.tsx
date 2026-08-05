import { z } from "zod";
import { requireAuth } from "~/lib/auth/session.server";
import { writeAuditLog } from "~/lib/services/audit/service";
import { getPolicy, savePolicy } from "~/lib/services/policy/data.service";
import type { Route } from "./+types/policies.$policyId.documents";

const MAX_DOCUMENTS = 50;
const MAX_PDF_BASE64_LENGTH = 20 * 1024 * 1024;
// Fingerprints include the bounded policy/document inputs and commonly exceed
// 500 characters (existing production rows are already >1,300 characters).
const MAX_GENERATION_KEY_LENGTH = 20_000;

const policyIdSchema = z.coerce.number().int().positive();
const policyDocumentSchema = z
  .object({
    policyDocumentId: z.number().int().positive(),
    policyId: z.number().int().positive(),
    name: z.string().trim().min(1).max(200),
    filename: z.string().trim().min(1).max(255),
    generationKey: z.string().max(MAX_GENERATION_KEY_LENGTH),
    content: z.string().max(500_000),
    templateKey: z.string().trim().min(1).max(200).optional(),
    libraryDocumentId: z.number().int().positive().optional(),
    mergeInputs: z
      .record(z.string().max(200), z.string().max(500_000))
      .optional(),
    pdfBase64: z.string().max(MAX_PDF_BASE64_LENGTH).optional(),
    generatedWhen: z.string().max(100),
    generatedBy: z.string().max(500),
  })
  .strict();

const policyDocumentsBodySchema = z
  .object({
    documents: z.array(policyDocumentSchema).max(MAX_DOCUMENTS).default([]),
  })
  .strict();

/** Persist generated policy documents (Postgres via Drizzle). */
export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "PUT" && request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const actor = await requireAuth(request);
  const parsedPolicyId = policyIdSchema.safeParse(params.policyId);
  if (!parsedPolicyId.success) {
    return Response.json(
      { ok: false, formError: "Invalid policy id." },
      { status: 400 },
    );
  }
  const policyId = parsedPolicyId.data;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { ok: false, formError: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  const parsedBody = policyDocumentsBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return Response.json(
      {
        ok: false,
        errors: parsedBody.error.flatten().fieldErrors,
        formError: "Document data is invalid or too large.",
      },
      { status: 400 },
    );
  }
  if (
    parsedBody.data.documents.some((document) => document.policyId !== policyId)
  ) {
    return Response.json(
      { ok: false, formError: "Document policy id does not match the route." },
      { status: 400 },
    );
  }

  const existing = await getPolicy(policyId);
  if (!existing) {
    return new Response("Policy not found", { status: 404 });
  }

  const documents = parsedBody.data.documents;
  const previousCount = existing.documents?.length ?? 0;
  const saved = await savePolicy({ ...existing, documents });
  if (documents.length !== previousCount) {
    await writeAuditLog({
      actor,
      action: "policy.documents_generate",
      entityType: "policy",
      entityId: policyId,
      summary: `Updated documents on ${existing.policyNumber} (${documents.length} file${documents.length === 1 ? "" : "s"})`,
      metadata: {
        policyNumber: existing.policyNumber,
        documentCount: documents.length,
        names: documents.map((d) => d.name),
      },
      request,
    });
  }
  return Response.json(saved.documents ?? documents);
}
