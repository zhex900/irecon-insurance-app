import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { appEmailTemplate } from "~/lib/db/schema";
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_KEYS,
  type EmailTemplate,
  type EmailTemplateKey,
} from "~/lib/email/templates";

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  const db = getDb();
  const rows = await db.select().from(appEmailTemplate);
  const byType = new Map(rows.map((row) => [row.recipientType, row]));

  return EMAIL_TEMPLATE_KEYS.map((recipientType) => {
    const row = byType.get(recipientType);
    const fallback = DEFAULT_EMAIL_TEMPLATES[recipientType];
    // Legacy single "broker" row → annual
    const legacyBroker =
      recipientType === "broker_annual" ? byType.get("broker") : undefined;
    const source = row ?? legacyBroker;
    const rawBody = source?.body?.trim() ? source.body : fallback.body;
    return {
      recipientType,
      subject: source?.subject?.trim() ? source.subject : fallback.subject,
      body: coerceTipTapEmailBody(recipientType, rawBody, fallback.body),
      toEmail:
        recipientType === "insurer"
          ? (source?.toEmail?.trim() ?? fallback.toEmail)
          : "",
    };
  });
}

function coerceTipTapEmailBody(
  recipientType: EmailTemplateKey,
  body: string,
  fallback: string,
) {
  if (!body.trim()) return fallback;

  // Only replace the old plain-text starter bodies — never discard authored HTML
  // (ASCX tables often omit <tbody> and intentionally mention iAnyware / ATCF).
  if (
    recipientType.startsWith("broker_") &&
    body.startsWith("Dear {{brokerName}}")
  ) {
    return fallback;
  }
  if (recipientType === "insurer" && body.startsWith("Dear Underwriter")) {
    return fallback;
  }

  return body;
}

export async function getEmailTemplate(
  recipientType: EmailTemplateKey,
): Promise<EmailTemplate> {
  const templates = await listEmailTemplates();
  return (
    templates.find((t) => t.recipientType === recipientType) ?? {
      recipientType,
      ...DEFAULT_EMAIL_TEMPLATES[recipientType],
    }
  );
}

export async function saveEmailTemplate(
  input: EmailTemplate,
  updatedBy = "",
): Promise<EmailTemplate> {
  const db = getDb();
  const subject = input.subject.trim();
  // Persist authored ASCX HTML as-is (no TipTap / outbound rewrites).
  const body = input.body.trim();
  const toEmail = input.recipientType === "insurer" ? input.toEmail.trim() : "";

  await db
    .insert(appEmailTemplate)
    .values({
      recipientType: input.recipientType,
      subject,
      body,
      toEmail,
      updatedWhen: new Date(),
      updatedBy,
    })
    .onConflictDoUpdate({
      target: appEmailTemplate.recipientType,
      set: {
        subject,
        body,
        toEmail,
        updatedWhen: new Date(),
        updatedBy,
      },
    });

  const [row] = await db
    .select()
    .from(appEmailTemplate)
    .where(eq(appEmailTemplate.recipientType, input.recipientType))
    .limit(1);

  return {
    recipientType: input.recipientType,
    subject: row?.subject ?? subject,
    body: row?.body ?? body,
    toEmail: row?.toEmail ?? toEmail,
  };
}

/** Restore the built-in ASCX-derived default for a template slot. */
export async function resetEmailTemplate(
  recipientType: EmailTemplateKey,
  updatedBy = "",
): Promise<EmailTemplate> {
  const fallback = DEFAULT_EMAIL_TEMPLATES[recipientType];
  const existing = await getEmailTemplate(recipientType);
  return saveEmailTemplate(
    {
      recipientType,
      subject: fallback.subject,
      body: fallback.body,
      toEmail: existing.toEmail,
    },
    updatedBy,
  );
}
