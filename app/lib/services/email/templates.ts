import { eq } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { appEmailTemplate } from "~/lib/db/schema";
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_RECIPIENT_TYPES,
  type EmailRecipientType,
  type EmailTemplate,
} from "~/lib/email-templates";

export {
  EMAIL_RECIPIENT_TYPES,
  applyEmailTemplate,
  type EmailRecipientType,
  type EmailTemplate,
  type EmailTemplateVars,
} from "~/lib/email-templates";

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  const db = getDb();
  const rows = await db.select().from(appEmailTemplate);
  const byType = new Map(rows.map((row) => [row.recipientType, row]));

  return EMAIL_RECIPIENT_TYPES.map((recipientType) => {
    const row = byType.get(recipientType);
    const fallback = DEFAULT_EMAIL_TEMPLATES[recipientType];
    return {
      recipientType,
      subject: row?.subject?.trim() ? row.subject : fallback.subject,
      body: row?.body?.trim() ? row.body : fallback.body,
      toEmail: row?.toEmail?.trim() ?? fallback.toEmail,
    };
  });
}

export async function getEmailTemplate(
  recipientType: EmailRecipientType,
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
