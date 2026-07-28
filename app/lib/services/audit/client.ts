/** Fire-and-forget audit event from the browser (material client-side actions). */
export function recordAuditEventClient(input: {
  action: "report.export";
  entityType?: string | null;
  entityId?: string | number | null;
  summary: string;
  metadata?: Record<string, unknown>;
}): void {
  void fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  }).catch(() => {
    // Audit must not block UX.
  });
}
