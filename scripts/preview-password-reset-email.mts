#!/usr/bin/env node
/**
 * Write password-reset email HTML to .preview/password-reset-email.html
 *
 *   npm run preview:password-reset-email
 *   open .preview/password-reset-email.html
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { buildPasswordResetEmail } from "../app/lib/email/password-reset-email.ts";
import { getEmailFooterImage } from "../app/lib/services/email/footer-image.server.ts";

const outDir = join(process.cwd(), ".preview");
const outPath = join(outDir, "password-reset-email.html");

const appUrl =
  process.env.APP_URL?.trim().replace(/\/$/, "") || "http://localhost:5173";
const resetLink = `${appUrl}/auth/confirm?next=/reset-password&code=preview-only`;

let footer: Awaited<ReturnType<typeof getEmailFooterImage>> | undefined;
try {
  footer = await getEmailFooterImage();
} catch {
  console.warn(
    "Warning: could not load footer image from DB — preview without logo.",
  );
}

const { subject, html, text } = buildPasswordResetEmail({
  resetLink,
  recipientName: "Preview User",
  footerImageDataUri: footer?.dataUri,
  footerImageWidth: footer?.displayWidth,
});

const document = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject.replace(/</g, "&lt;")}</title>
  <style>
    body { margin: 0; padding: 24px; background: #f3f4f6; }
    .meta { max-width: 640px; margin: 0 auto 16px; font: 14px/1.4 system-ui, sans-serif; color: #374151; }
    .frame { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .body { padding: 24px; }
    pre { max-width: 640px; margin: 24px auto 0; padding: 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; font: 12px/1.5 ui-monospace, monospace; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="meta"><strong>Subject:</strong> ${subject.replace(/</g, "&lt;")}</div>
  <div class="frame"><div class="body">${html}</div></div>
  <pre>${text.replace(/</g, "&lt;")}</pre>
</body>
</html>`;

await mkdir(outDir, { recursive: true });
await writeFile(outPath, document, "utf8");

console.log(`Subject: ${subject}`);
console.log(`Wrote ${outPath}`);
console.log(`Open: open ${outPath}`);
