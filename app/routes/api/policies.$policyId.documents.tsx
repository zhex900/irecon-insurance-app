import { z } from "zod";

import { requireAuth } from "~/lib/auth/session/server.server";
import { parseUuid } from "~/lib/http/route-input";
import { trackUsage } from "~/lib/observability/metrics.server";
import { writeAuditLog } from "~/lib/services/audit/service";
import { getPolicy, savePolicy } from "~/lib/services/policy/data.service";

import type { Route } from "./+types/policies.$policyId.documents";

const MAX_DOCUMENTS = 50;
const MAX_PDF_BASE64_LENGTH = 20 * 1024 * 1024;
// Fingerprints include the bounded policy/document inputs and commonly exceed
// 500 characters (existing production rows are already >1,300 characters).
const MAX_GENERATION_KEY_LENGTH = 20_000;

const policyDocumentSchema = z
  .object({
    policyDocumentId: z.number().int().positive(),
    policyId: z.string().uuid(),
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
    documentTypeCode: z.string().trim().max(50).optional(),
  })
  .strict();

const policyDocumentsBodySchema = z
  .object({
    documents: z.array(policyDocumentSchema).max(MAX_DOCUMENTS).default([]),
  })
  .strict();

/** Overwrite each document's `policyId` with the route's before validation. */
function normalizeDocumentPolicyIds(body: unknown, policyId: string): unknown {
  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { documents?: unknown }).documents)
  ) {
    return body;
  }
  const documents = (body as { documents: unknown[] }).documents.map((doc) =>
    typeof doc === "object" && doc !== null ? { ...doc, policyId } : doc,
  );
  return { ...body, documents };
}

/** Persist generated policy documents (Postgres via Drizzle). */
export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "PUT" && request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const actor = await requireAuth(request);
  const policyId = parseUuid(params.policyId);
  if (!policyId) {
    return Response.json(
      { ok: false, formError: "Invalid policy id." },
      { status: 400 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { ok: false, formError: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  // Documents always belong to the route's policy — force this before
  // validating so legacy rows (pre "policy to uuid" migration stored a
  // numeric policyId) don't fail schema validation for the whole batch.
  const normalizedBody = normalizeDocumentPolicyIds(rawBody, policyId);
  const parsedBody = policyDocumentsBodySchema.safeParse(normalizedBody);
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
  const existing = await getPolicy(policyId);
  if (!existing) {
    return new Response("Policy not found", { status: 404 });
  }

  const documents = parsedBody.data.documents;
  const previousCount = existing.documents?.length ?? 0;
  const saved = await savePolicy({ ...existing, documents });
  const countChanged = documents.length !== previousCount;
  trackUsage("document.generate", {
    result: "success",
    count_changed: countChanged,
    surface: "policy_documents_api",
  });
  if (countChanged) {
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
