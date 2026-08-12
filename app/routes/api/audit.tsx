import { requireAuth } from "~/lib/auth/session.server";
import { AUDIT_ACTIONS, type AuditAction } from "~/constants";
import { writeAuditLog } from "~/lib/services/audit/service";
import type { Route } from "./+types/audit";

const CLIENT_ALLOWED = new Set<string>(["report.export"]);

/**
 * Record a material audit event initiated from the browser (e.g. CSV export).
 * Policy document email is audited server-side after Resend succeeds.
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const actor = await requireAuth(request);
  const body = (await request.json()) as {
    action?: string;
    entityType?: string | null;
    entityId?: string | number | null;
    summary?: string;
    metadata?: Record<string, unknown>;
  };

  const actionCode = String(body.action ?? "").trim();
  if (!CLIENT_ALLOWED.has(actionCode)) {
    return Response.json({ error: "Action not allowed" }, { status: 400 });
  }
  if (!AUDIT_ACTIONS.includes(actionCode as (typeof AUDIT_ACTIONS)[number])) {
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  const summary = String(body.summary ?? "").trim();
  if (!summary) {
    return Response.json({ error: "Summary is required" }, { status: 400 });
  }

  await writeAuditLog({
    actor,
    action: actionCode as AuditAction,
    entityType: body.entityType ?? null,
    entityId: body.entityId ?? null,
    summary,
    metadata: body.metadata ?? {},
    request,
  });

  return Response.json({ ok: true });
}
