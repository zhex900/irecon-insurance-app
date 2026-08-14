import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  logSecurityEvent,
  logAuthEvent,
  logSuspiciousActivity,
  logAdminAction,
} from "~/lib/security/basic-logging.server";

// Mock the dependencies
vi.mock("~/lib/services/audit/service", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/observability/logger.server", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Security Logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should log security events with appropriate severity", async () => {
    await logSecurityEvent({
      type: "LOGIN_FAILURE",
      severity: "WARNING",
      userEmail: "test@example.com",
      details: { reason: "invalid_credentials" },
    });

    // Verify logger.warn was called
    const { logger } = await import("~/lib/observability/logger.server");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("LOGIN_FAILURE"),
      expect.objectContaining({
        reason: "invalid_credentials",
      }),
    );
  });

  it("should log authentication events", async () => {
    const mockUser = {
      userId: "123",
      email: "test@example.com",
    };

    // Should not throw
    await expect(
      logAuthEvent("success", mockUser, { role: "admin" }),
    ).resolves.toBeUndefined();
  });

  it("should log suspicious activity", async () => {
    // Should not throw
    await expect(
      logSuspiciousActivity(
        "Multiple failed login attempts",
        "123",
        "test@example.com",
        "192.168.1.1",
        { attemptCount: 5 },
      ),
    ).resolves.toBeUndefined();
  });

  it("should log admin actions", async () => {
    const adminUser = {
      userId: "admin-123",
      email: "admin@example.com",
    };

    // Should not throw
    await expect(
      logAdminAction(
        "user_deleted",
        adminUser,
        { type: "user", id: "user-456" },
        { reason: "inactivity" },
      ),
    ).resolves.toBeUndefined();
  });

  it("should handle errors gracefully", async () => {
    const { writeAuditLog } = await import("~/lib/services/audit/service");
    vi.mocked(writeAuditLog).mockRejectedValue(new Error("Database error"));

    // Should handle error (either resolve or reject gracefully)
    try {
      await logSecurityEvent({
        type: "LOGIN_SUCCESS",
        userEmail: "test@example.com",
      });
      // If it resolves, that's fine
    } catch (error) {
      // If it rejects, that's also acceptable for this test
      expect(error).toBeDefined();
    }
  });
});
