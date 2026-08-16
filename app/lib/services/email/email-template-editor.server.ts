import { z } from "zod";
import { requireFeatureOrSuperAdminPage } from "~/lib/auth/authorize.server";
import { requireAuth } from "~/lib/auth/session/server.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import {
  EMAIL_TEMPLATE_KEYS,
  EMAIL_TEMPLATE_META,
  htmlToPlainText,
  type EmailTemplateKey,
} from "~/lib/email/templates";
import type { EmailTemplateEditorLoaderData } from "~/lib/email/template-editor-types";
import { writeAuditLog } from "~/lib/services/audit/service";
import { redirectResponse } from "~/lib/http/redirect-response";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { parseFormIntent } from "~/lib/http/route-input";
import { getEmailFooterImage } from "~/lib/services/email/footer-image.server";
import { sendEmail } from "~/lib/services/email/resend.server";
import {
  getEmailTemplate,
  resetEmailTemplate,
  saveEmailTemplate,
} from "~/lib/services/email/templates.server";
import { isFeatureEnabled } from "~/lib/services/feature-flags";

type EmailTemplateRequestArgs = {
  request: Request;
  params: { key?: string };
};

const emailTemplateKeySchema = z.enum(EMAIL_TEMPLATE_KEYS);

export async function loadEmailTemplateEditor({
  request,
  params,
}: EmailTemplateRequestArgs): Promise<EmailTemplateEditorLoaderData> {
  const viewer = await requireAuth(request);
  const emailTemplatesEnabled = await isFeatureEnabled("email_templates");
  requireFeatureOrSuperAdminPage(emailTemplatesEnabled, viewer);

  const parsedKey = emailTemplateKeySchema.safeParse(params.key);
  if (!parsedKey.success) {
    throw redirectResponse("/settings/email-templates");
  }
  const key: EmailTemplateKey = parsedKey.data;

  const template = await getEmailTemplate(key);
  const meta = EMAIL_TEMPLATE_META[key];
  const footer = await getEmailFooterImage();

  return {
    template,
    meta,
    canEdit: isSuperAdmin(viewer),
    emailTemplatesEnabled,
    viewerEmail: viewer.email,
    footerImageDataUri: footer.dataUri,
    footerImageWidth: footer.displayWidth,
  };
}

export async function emailTemplateAction({
  request,
  params,
}: EmailTemplateRequestArgs) {
  const viewer = await requireAuth(request);
  if (!isSuperAdmin(viewer)) {
    return {
      ok: false as const,
      error: "Only super-admins can change email templates.",
    };
  }

  const parsedKey = emailTemplateKeySchema.safeParse(params.key);
  if (!parsedKey.success) {
    return { ok: false as const, error: "Unknown template." };
  }
  const key: EmailTemplateKey = parsedKey.data;

  const formData = await request.formData();
  const intent = parseFormIntent(
    formData,
    ["save", "reset", "send-preview"],
    "save",
  );
  if (!intent) return { ok: false as const, error: "Unknown action." };

  if (intent === "send-preview") {
    const to = String(formData.get("to") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const html = String(formData.get("html") ?? "").trim();
    const text =
      String(formData.get("text") ?? "").trim() || htmlToPlainText(html);

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { ok: false as const, error: "Enter a valid email address." };
    }
    if (!subject) {
      return { ok: false as const, error: "Subject is required." };
    }
    if (!html) {
      return { ok: false as const, error: "Message body is required." };
    }

    try {
      const sent = await sendEmail({
        to,
        subject: `[Preview] ${subject}`,
        html,
        text,
        tags: [
          { name: "kind", value: "email_template_preview" },
          { name: "template", value: key },
        ],
      });
      await writeAuditLog({
        actor: viewer,
        action: "settings.email_template_preview",
        entityType: "email_template",
        entityId: key,
        summary: `Sent ${EMAIL_TEMPLATE_META[key].title} preview to ${to}`,
        metadata: { recipientType: key, to, resendId: sent.id },
        request,
      });
      return {
        ok: true as const,
        sent: true as const,
        to,
        reset: false as const,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Could not send preview email.",
          operation: "email_template_preview_send",
        }),
      };
    }
  }

  if (intent === "reset") {
    const saved = await resetEmailTemplate(key, viewer.email);
    const meta = EMAIL_TEMPLATE_META[key];
    await writeAuditLog({
      actor: viewer,
      action: "settings.email_template_reset",
      entityType: "email_template",
      entityId: key,
      summary: meta.sourceAscx
        ? `Reset ${meta.title} from ${meta.sourceAscx}`
        : `Reset ${meta.title} to default`,
      metadata: { recipientType: key, source: meta.sourceAscx },
      request,
    });
    return { ok: true as const, template: saved, reset: true as const };
  }

  const subject = String(formData.get("subject") ?? "");
  const body = String(formData.get("body") ?? "");
  const toEmail = String(formData.get("toEmail") ?? "");

  if (!subject.trim()) {
    return { ok: false as const, error: "Subject is required." };
  }
  if (!body.trim()) {
    return { ok: false as const, error: "Message body is required." };
  }
  if (key === "insurer" && !toEmail.trim()) {
    return { ok: false as const, error: "Insurer email address is required." };
  }
  if (
    key === "insurer" &&
    toEmail.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail.trim())
  ) {
    return {
      ok: false as const,
      error: "Enter a valid insurer email address.",
    };
  }

  const saved = await saveEmailTemplate(
    { recipientType: key, subject, body, toEmail },
    viewer.email,
  );
  await writeAuditLog({
    actor: viewer,
    action: "settings.email_template",
    entityType: "email_template",
    entityId: key,
    summary: `Updated ${EMAIL_TEMPLATE_META[key].title} email template`,
    metadata: {
      recipientType: key,
      hasToEmail: Boolean(saved.toEmail),
    },
    request,
  });

  return { ok: true as const, template: saved, reset: false as const };
}
