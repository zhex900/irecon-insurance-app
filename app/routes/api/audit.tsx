import { z } from "zod";
import { requireAuth } from "~/lib/auth/session.server";
import { AUDIT_ACTIONS, type AuditAction } from "~/constants";
import { writeAuditLog } from "~/lib/services/audit/service";
import type { Route } from "./+types/audit";

const CLIENT_ALLOWED = new Set<string>(["report.export"]);

const auditBodySchema = z.object({
  action: z.string().trim().min(1),
  entityType: z.string().nullish(),
  entityId: z.union([z.string(), z.number()]).nullish(),
  summary: z.string().trim().min(1, "Summary is required"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Record a material audit event initiated from the browser (e.g. CSV export).
 * Policy document email is audited server-side after Resend succeeds.
 */
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const actor = await requireAuth(request);
  const json = await request.json().catch(() => null);
  const parsed = auditBodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid audit payload" }, { status: 400 });
  }
  const body = parsed.data;

  const actionCode = body.action;
  if (!CLIENT_ALLOWED.has(actionCode)) {
    return Response.json({ error: "Action not allowed" }, { status: 400 });
  }
  if (!AUDIT_ACTIONS.includes(actionCode as (typeof AUDIT_ACTIONS)[number])) {
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  await writeAuditLog({
    actor,
    action: actionCode as AuditAction,
    entityType: body.entityType ?? null,
    entityId: body.entityId ?? null,
    summary: body.summary,
    metadata: body.metadata ?? {},
    request,
  });

  return Response.json({ ok: true });
}
