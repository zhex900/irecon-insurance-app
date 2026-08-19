import { buildPasswordResetEmail } from "~/lib/email/password-reset-email";
import { getEmailFooterImage } from "~/lib/services/email/footer-image.server";
import {
  getAuthEmailFrom,
  sendEmail,
} from "~/lib/services/email/resend.server";

export async function sendPasswordResetEmail(input: {
  to: string;
  resetLink: string;
  recipientName?: string;
}) {
  const footer = await getEmailFooterImage();
  const { subject, text, html } = buildPasswordResetEmail({
    resetLink: input.resetLink,
    recipientName: input.recipientName,
    footerImageDataUri: footer.dataUri,
    footerImageWidth: footer.displayWidth,
  });

  return sendEmail({
    to: input.to,
    from: getAuthEmailFrom(),
    subject,
    text,
    html,
    replyTo: null,
    tags: [{ name: "category", value: "auth_password_reset" }],
  });
}
