import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clientIpFromRequest,
  verifyTurnstileToken,
} from "~/lib/turnstile/verify.server";

describe("verifyTurnstileToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success when siteverify accepts the token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }),
    );

    const result = await verifyTurnstileToken("token", "secret", "1.2.3.4");
    expect(result).toEqual({ success: true, errorCodes: [] });
    expect(fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns failure when siteverify rejects the token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          "error-codes": ["invalid-input-response"],
        }),
      }),
    );

    const result = await verifyTurnstileToken("bad", "secret");
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain("invalid-input-response");
  });
});

describe("clientIpFromRequest", () => {
  it("prefers CF-Connecting-IP", () => {
    const request = new Request("https://example.com", {
      headers: {
        "CF-Connecting-IP": "203.0.113.1",
        "X-Forwarded-For": "198.51.100.1",
      },
    });
    expect(clientIpFromRequest(request)).toBe("203.0.113.1");
  });

  it("falls back to the first X-Forwarded-For entry", () => {
    const request = new Request("https://example.com", {
      headers: { "X-Forwarded-For": "198.51.100.1, 10.0.0.1" },
    });
    expect(clientIpFromRequest(request)).toBe("198.51.100.1");
  });
});
