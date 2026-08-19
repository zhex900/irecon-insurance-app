import { describe, expect, it } from "vitest";

import {
  requireAdminPage,
  requireFeatureOrSuperAdminPage,
  requireSuperAdminPage,
  throwUnauthorizedPage,
  UNAUTHORIZED_PAGE_MESSAGE,
} from "~/lib/auth/authorize.server";

describe("authorize.server page guards", () => {
  it("throwUnauthorizedPage raises 403 with the default message", () => {
    try {
      throwUnauthorizedPage();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      const response = error as Response;
      expect(response.status).toBe(403);
      return response.text().then((body) => {
        expect(body).toBe(UNAUTHORIZED_PAGE_MESSAGE);
      });
    }
  });

  it("requireAdminPage allows admin and super-admin", () => {
    expect(() => requireAdminPage({ role: "admin" })).not.toThrow();
    expect(() => requireAdminPage({ role: "super-admin" })).not.toThrow();
  });

  it("requireAdminPage forbids brokers", async () => {
    try {
      requireAdminPage({ role: "broker" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(403);
    }
  });

  it("requireSuperAdminPage forbids admin", () => {
    try {
      requireSuperAdminPage({ role: "admin" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(403);
    }
  });

  it("requireFeatureOrSuperAdminPage allows super-admin when disabled", () => {
    expect(() =>
      requireFeatureOrSuperAdminPage(false, { role: "super-admin" }),
    ).not.toThrow();
  });

  it("requireFeatureOrSuperAdminPage forbids broker when disabled", () => {
    try {
      requireFeatureOrSuperAdminPage(false, { role: "broker" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(403);
    }
  });
});
