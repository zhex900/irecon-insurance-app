import { requireAuth } from "~/lib/auth/session.server";
import { writeAuditLog } from "~/lib/services/audit/service";
import { getPolicy, savePolicy } from "~/lib/services/policy/data.service";
import type { PolicyDocument } from "~/lib/db/types";
import type { Route } from "./+types/policies.$policyId.documents";

/** Persist generated policy documents (Postgres via Drizzle). */
export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "PUT" && request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const actor = await requireAuth(request);
  const policyId = Number(params.policyId);
  const body = (await request.json()) as { documents?: PolicyDocument[] };
  const existing = await getPolicy(policyId);
  if (!existing) {
    return new Response("Policy not found", { status: 404 });
  }

  const documents = body.documents ?? [];
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
