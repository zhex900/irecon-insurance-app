import { APP_NAME } from "~/lib/brand";
import {
  clampEmailFooterDisplayWidth,
  EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT,
} from "~/lib/email/footer-display";
import { wrapEmailDocumentHtml } from "~/lib/email/template-formatting";

export type PasswordResetEmailInput = {
  resetLink: string;
  recipientName?: string;
  footerImageDataUri?: string;
  footerImageWidth?: number;
};

function greeting(name?: string) {
  const trimmed = name?.trim();
  return trimmed ? `Hi ${trimmed},` : "Hi,";
}

export function buildPasswordResetEmail(input: PasswordResetEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const resetLink = input.resetLink.trim();
  const footerWidth = clampEmailFooterDisplayWidth(
    input.footerImageWidth ?? EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT,
  );
  const footer = input.footerImageDataUri?.trim();
  const greetingLine = greeting(input.recipientName);

  const text = [
    greetingLine,
    "",
    `We received a request to reset your ${APP_NAME} password.`,
    "",
    `Reset your password: ${resetLink}`,
    "",
    "This link expires after a short time. If you did not request a reset, you can ignore this email.",
    "",
    APP_NAME,
  ].join("\n");

  const footerBlock = footer
    ? `<p style="margin:32px 0 0"><img alt="${APP_NAME} logo" src="${footer}" width="${footerWidth}" style="display:block;width:${footerWidth}px;max-width:100%;height:auto" /></p>`
    : "";

  const bodyHtml = wrapEmailDocumentHtml(`
<p style="margin:0 0 16px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111827">
  ${greetingLine}
</p>
<p style="margin:0 0 16px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111827">
  We received a request to reset your ${APP_NAME} password. Click the button below to choose a new password.
</p>
<p style="margin:0 0 24px">
  <a href="${resetLink}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#111827;color:#ffffff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;font-weight:600;text-decoration:none">
    Reset password
  </a>
</p>
<p style="margin:0 0 16px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.5;color:#4b5563">
  Or copy and paste this link into your browser:<br />
  <a href="${resetLink}" style="color:#111827;word-break:break-all">${resetLink}</a>
</p>
<p style="margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:13px;line-height:1.5;color:#6b7280">
  This link expires after a short time. If you did not request a password reset, you can safely ignore this email.
</p>
${footerBlock}
`.trim());

  return {
    subject: `Reset your ${APP_NAME} password`,
    text,
    html: bodyHtml,
  };
}
