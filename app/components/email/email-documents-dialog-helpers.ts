import {
  applyEmailTemplate,
  buildOutboundTemplateHtml,
  type EmailSendRecipient,
  type EmailTemplateVars,
} from "~/lib/email/templates";
import type { FileWithPreview } from "~/hooks/utilities";

export const EMAIL_DOCUMENTS_RECIPIENT_LABELS: Record<
  EmailSendRecipient,
  string
> = {
  broker: "broker",
  insurer: "insurer",
};

export const EMAIL_DOCUMENTS_EXTRA_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,image/png,image/jpeg";

export const EMAIL_DOCUMENTS_EXTRA_MAX_FILES = 10;
export const EMAIL_DOCUMENTS_EXTRA_MAX_SIZE = 5 * 1024 * 1024;

export function filledEmailDocumentsTemplateBody(
  body: string,
  vars: EmailTemplateVars,
  logoWidth: number,
): string {
  return buildOutboundTemplateHtml(applyEmailTemplate(body, vars), {
    footerImageWidth: logoWidth,
    footerImageDataUri: vars.footerImage,
  });
}

export async function emailAttachmentToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function isBrowserUploadFile(
  file: FileWithPreview["file"],
): file is File {
  return typeof File !== "undefined" && file instanceof File;
}
