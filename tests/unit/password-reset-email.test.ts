import { describe, expect, it } from "vitest";

import { buildPasswordResetEmail } from "~/lib/email/password-reset-email";

describe("buildPasswordResetEmail", () => {
  it("includes reset link and branded subject", () => {
    const { subject, text, html } = buildPasswordResetEmail({
      resetLink: "https://app.example.com/auth/confirm?code=abc",
      recipientName: "Alex Broker",
    });

    expect(subject).toContain("Reset your");
    expect(text).toContain("Hi Alex Broker,");
    expect(text).toContain("https://app.example.com/auth/confirm?code=abc");
    expect(html).toContain("Reset password");
    expect(html).toContain("https://app.example.com/auth/confirm?code=abc");
  });
});
