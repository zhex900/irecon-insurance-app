import type { EmailTemplate, EmailTemplateMeta } from "~/lib/email/templates";

/** Loader payload shape for the email template editor (client-safe). */
export type EmailTemplateEditorLoaderData = {
  template: EmailTemplate;
  meta: EmailTemplateMeta;
  canEdit: boolean;
  emailTemplatesEnabled: boolean;
  viewerEmail: string;
  footerImageDataUri: string;
  footerImageWidth: number;
};
