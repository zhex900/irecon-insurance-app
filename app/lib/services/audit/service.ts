import { and, desc, eq, gte, ilike, lte, or, type SQL,sql } from "drizzle-orm";

import { AUDIT_ACTIONS, type AuditAction } from "~/constants";
import { isAdminRole } from "~/lib/auth/roles";
import { getDb } from "~/lib/db/client";
import { auditLog } from "~/lib/db/schema";
import type { AppUser, AuditLogEntry } from "~/lib/db/types";
import { logger } from "~/lib/observability/logger.server";

export { AUDIT_ACTIONS, type AuditAction };

export type AuditActor = Pick<AppUser, "userId" | "email" | "fullName"> | null;

type WriteAuditLogInput = {
  actor?: AuditActor;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | number | null;
  summary: string;
  metadata?: Record<string, unknown>;
  request?: Request | null;
};

function normalizeEntry(row: typeof auditLog.$inferSelect): AuditLogEntry {
  return {
    auditLogId: Number(row.auditLogId),
    occurredAt: row.occurredAt.toISOString(),
    actorUserId: row.actorUserId ?? null,
    actorEmail: row.actorEmail ?? "",
    actorName: row.actorName ?? "",
    action: row.action,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    summary: row.summary,
    metadata:
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    requestPath: row.requestPath ?? null,
  };
}

/** Persist an audit row. Never throws — failures are logged only. */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  try {
    const db = getDb();
    const path = input.request ? new URL(input.request.url).pathname : null;
    await db.insert(auditLog).values({
      actorUserId: input.actor?.userId ?? null,
      actorEmail: input.actor?.email?.trim().toLowerCase() ?? "",
      actorName: input.actor?.fullName?.trim() ?? "",
      action: input.action,
      entityType: input.entityType ?? null,
      entityId:
        input.entityId == null || input.entityId === ""
          ? null
          : String(input.entityId),
      summary: input.summary,
      metadata: input.metadata ?? {},
      requestPath: path,
    });
  } catch (error) {
    logger.error("writeAuditLog failed", {
      error: error instanceof Error ? error.message : "audit_write_failed",
    });
  }
}

export type ListAuditLogsInput = {
  viewer: AppUser;
  q?: string;
  action?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type ListAuditLogsResult = {
  rows: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
};

export async function listAuditLogs(
  input: ListAuditLogsInput,
): Promise<ListAuditLogsResult> {
  const db = getDb();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);
  const isAdmin = isAdminRole(input.viewer);

  const filters: SQL[] = [];

  if (!isAdmin) {
    filters.push(eq(auditLog.actorUserId, input.viewer.userId));
  } else if (input.actorUserId?.trim()) {
    filters.push(eq(auditLog.actorUserId, input.actorUserId.trim()));
  }

  if (input.action?.trim()) {
    filters.push(eq(auditLog.action, input.action.trim()));
  }

  if (input.from?.trim()) {
    const fromDate = new Date(input.from);
    if (!Number.isNaN(fromDate.getTime())) {
      filters.push(gte(auditLog.occurredAt, fromDate));
    }
  }

  if (input.to?.trim()) {
    const toDate = new Date(input.to);
    if (!Number.isNaN(toDate.getTime())) {
      // Inclusive end-of-day when only a date is provided.
      if (/^\d{4}-\d{2}-\d{2}$/.test(input.to.trim())) {
        toDate.setHours(23, 59, 59, 999);
      }
      filters.push(lte(auditLog.occurredAt, toDate));
    }
  }

  const q = input.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    filters.push(
      or(
        ilike(auditLog.summary, pattern),
        ilike(auditLog.actorEmail, pattern),
        ilike(auditLog.actorName, pattern),
        ilike(auditLog.action, pattern),
        ilike(auditLog.entityId, pattern),
      )!,
    );
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(where);

  const rows = await db
    .select()
    .from(auditLog)
    .where(where)
    .orderBy(desc(auditLog.occurredAt), desc(auditLog.auditLogId))
    .limit(limit)
    .offset(offset);

  return {
    rows: rows.map(normalizeEntry),
    total: Number(countRow?.count ?? 0),
    limit,
    offset,
  };
}
