import { toast } from "sonner";

import {
  EMAIL_DOCUMENTS_RECIPIENT_LABELS,
  emailAttachmentToBase64,
  isBrowserUploadFile,
} from "~/components/email/email-documents-dialog-helpers";
import type { EmailRichEditorHandle } from "~/components/email/email-rich-editor";
import type { FileWithPreview } from "~/hooks/utilities";
import type { PolicyDocument } from "~/lib/db/types";
import {
  buildOutboundTemplateHtml,
  type EmailSendRecipient,
  type EmailTemplateVars,
  htmlToPlainText,
  preferEmailHtml,
} from "~/lib/email/templates";

export async function sendPolicyDocumentsEmail({
  policyId,
  attachments,
  extraFiles,
  to,
  cc,
  subject,
  useTemplateHtml,
  editorContent,
  editorHandle,
  vars,
  logoWidth,
  recipientType,
  onSuccess,
}: {
  policyId: string;
  attachments: PolicyDocument[];
  extraFiles: FileWithPreview[];
  to: string;
  cc: string;
  subject: string;
  useTemplateHtml: boolean;
  editorContent: string;
  editorHandle: EmailRichEditorHandle | null;
  vars: EmailTemplateVars;
  logoWidth: number;
  recipientType: EmailSendRecipient;
  onSuccess: () => void;
}) {
  const recipient = to.trim();
  if (!recipient) {
    toast.error("Enter at least one recipient email.");
    return;
  }
  if (attachments.length === 0 && extraFiles.length === 0) {
    toast.error("Attach at least one document.");
    return;
  }
  if (!policyId) {
    toast.error("Policy is missing. Reload and try again.");
    return;
  }

  let html: string;
  let text: string;
  if (useTemplateHtml) {
    html = buildOutboundTemplateHtml(editorContent, {
      footerImageDataUri: vars.footerImage,
      footerImageWidth: logoWidth,
    });
    text = htmlToPlainText(html);
  } else {
    const exported = await editorHandle?.getEmail();
    const documentHtml =
      editorHandle?.getDocumentHtml().trim() || editorContent;
    html = preferEmailHtml({
      documentHtml,
      exportedHtml: exported?.html,
      footerImageDataUri: vars.footerImage,
      footerImageWidth: logoWidth,
    });
    text = exported?.text?.trim() || htmlToPlainText(html);
  }
  if (!html) {
    throw new Error("Message body is empty.");
  }

  const extraAttachments: Array<{
    filename: string;
    contentBase64: string;
    contentType?: string;
  }> = [];
  for (const item of extraFiles) {
    if (!isBrowserUploadFile(item.file)) continue;
    extraAttachments.push({
      filename: item.file.name,
      contentBase64: await emailAttachmentToBase64(item.file),
      contentType: item.file.type || undefined,
    });
  }

  const response = await fetch(`/api/policies/${policyId}/email-documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      documentIds: attachments.map((doc) => doc.policyDocumentId),
      extraAttachments,
      to: recipient,
      cc: cc.trim() || undefined,
      subject: subject.trim(),
      body: text || html,
      html,
      recipientType,
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    error?: string;
    ok?: boolean;
  } | null;
  if (!response.ok) {
    throw new Error(data?.error || "Could not send email. Try again.");
  }

  onSuccess();
  const attachmentCount = attachments.length + extraFiles.length;
  window.setTimeout(() => {
    toast.success("Email sent", {
      description: `Sent to ${recipient} · ${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"} (${EMAIL_DOCUMENTS_RECIPIENT_LABELS[recipientType]})`,
      duration: 5000,
    });
  }, 0);
}
