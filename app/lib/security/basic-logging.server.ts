/**
 * Basic security logging for simple internal insurance app
 *
 * Minimal enhancement to existing audit logging - focuses on critical security events
 * that help identify potential issues without complex infrastructure.
 */

import type { AppUser } from "~/lib/db/types";
import { logger } from "~/lib/observability/logger.server";
import { writeAuditLog } from "~/lib/services/audit/service";

export type SecurityEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET_SUCCESS"
  | "SUSPICIOUS_ACTIVITY"
  | "RATE_LIMIT_HIT"
  | "ADMIN_ACTION"
  | "POLICY_CREATED"
  | "POLICY_MODIFIED"
  | "POLICY_DELETED"
  | "API_REQUEST";

export interface SecurityEventLog {
  type: SecurityEventType;
  severity: "INFO" | "WARNING" | "ERROR";
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

/**
 * Log a security event to enhance existing audit logging
 *
 * For simple internal app, this logs to both:
 * 1. Console (for immediate visibility)
 * 2. Audit database (for historical tracking)
 * 3. Sentry for critical issues (via existing error handling)
 */
export async function logSecurityEvent({
  type,
  severity = "INFO",
  userId,
  userEmail,
  ipAddress,
  userAgent,
  details = {},
  request,
}: {
  type: SecurityEventType;
  severity?: SecurityEventLog["severity"];
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  request?: Request;
}): Promise<void> {
  const _timestamp = new Date().toISOString();

  // Console logging for immediate visibility (development & production monitoring)
  const logMessage = `[SECURITY] ${type} - Severity: ${severity} - User: ${userEmail || userId || "unknown"}`;

  switch (severity) {
    case "ERROR":
      logger.error(logMessage, { ...details, ipAddress, userAgent });
      break;
    case "WARNING":
      logger.warn(logMessage, { ...details, ipAddress, userAgent });
      break;
    default:
      logger.info(logMessage, { ...details, ipAddress, userAgent });
  }

  // Write to audit database for historical tracking
  // For critical events or if we have user context
  if (userId || userEmail) {
    // Only create actor if we have a userId (required by AuditActor)
    const actor = userId
      ? {
          userId,
          email: userEmail || "",
          fullName: "",
        }
      : null;

    // Map security event type to audit action
    const auditAction = getAuditActionForSecurityEvent(type);

    await writeAuditLog({
      actor,
      action: auditAction,
      summary: `Security event: ${type}`,
      metadata: {
        securityEventType: type,
        severity,
        ipAddress,
        userAgent,
        ...details,
      },
      request,
    });
  }
}

/**
 * Map security event types to audit actions for consistency
 */
function getAuditActionForSecurityEvent(type: SecurityEventType): string {
  switch (type) {
    case "LOGIN_SUCCESS":
      return "auth.login";
    case "LOGIN_FAILURE":
      return "auth.login_failed";
    case "LOGOUT":
      return "auth.logout";
    case "PASSWORD_RESET_REQUEST":
      return "auth.password_reset_request";
    case "PASSWORD_RESET_SUCCESS":
      return "auth.password_reset_success";
    case "ADMIN_ACTION":
      return "admin.action";
    case "POLICY_CREATED":
      return "policy.create";
    case "POLICY_MODIFIED":
      return "policy.update";
    case "POLICY_DELETED":
      return "policy.delete";
    case "API_REQUEST":
      return "api.request";
    case "SUSPICIOUS_ACTIVITY":
    case "RATE_LIMIT_HIT":
    default:
      return "security.event";
  }
}

/**
 * Helper for logging authentication events
 */
export async function logAuthEvent(
  event: "success" | "failure" | "logout" | "password_reset",
  user: Partial<AppUser> | null,
  details?: Record<string, unknown>,
  request?: Request,
): Promise<void> {
  let eventType: SecurityEventType;
  let severity: SecurityEventLog["severity"] = "INFO";

  switch (event) {
    case "success":
      eventType = "LOGIN_SUCCESS";
      break;
    case "failure":
      eventType = "LOGIN_FAILURE";
      severity = "WARNING";
      break;
    case "logout":
      eventType = "LOGOUT";
      break;
    case "password_reset":
      eventType = "PASSWORD_RESET_SUCCESS";
      break;
  }

  await logSecurityEvent({
    type: eventType,
    severity,
    userId: user?.userId,
    userEmail: user?.email,
    details,
    request,
  });
}

/**
 * Helper for logging suspicious activity
 */
export async function logSuspiciousActivity(
  description: string,
  userId?: string,
  userEmail?: string,
  ipAddress?: string,
  details?: Record<string, unknown>,
  request?: Request,
): Promise<void> {
  await logSecurityEvent({
    type: "SUSPICIOUS_ACTIVITY",
    severity: "WARNING",
    userId,
    userEmail,
    ipAddress,
    details: {
      description,
      ...details,
    },
    request,
  });
}

/**
 * Helper for logging admin actions
 */
export async function logAdminAction(
  action: string,
  adminUser: { userId: string; email: string },
  target?: { type: string; id: string },
  details?: Record<string, unknown>,
  request?: Request,
): Promise<void> {
  await logSecurityEvent({
    type: "ADMIN_ACTION",
    severity: "INFO",
    userId: adminUser.userId,
    userEmail: adminUser.email,
    details: {
      adminAction: action,
      targetType: target?.type,
      targetId: target?.id,
      ...details,
    },
    request,
  });
}
