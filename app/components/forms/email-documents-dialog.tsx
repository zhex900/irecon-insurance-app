import { useEffect, useMemo, useRef, useState } from "react";
import { FileTextIcon, MailIcon, PaperclipIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { EmailDocumentFrame } from "~/components/forms/email-document-frame";
import {
  EmailRichEditor,
  type EmailRichEditorHandle,
} from "~/components/forms/email-rich-editor";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { EmailRecipientsInput } from "~/components/forms/email-recipients-input";
import type { PolicyDocument } from "~/lib/db/types";
import { Badge } from "~/components/reui/badge";
import type { EmailDirectoryEntry } from "~/lib/email/directory";
import { EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT } from "~/lib/email/footer-display";
import {
  applyEmailTemplate,
  buildOutboundTemplateHtml,
  EMAIL_TEMPLATE_META,
  ensureEmailEditorHtml,
  htmlToPlainText,
  isEmailHtmlBody,
  preferEmailHtml,
  type EmailSendRecipient,
  type EmailTemplate,
  type EmailTemplateVars,
} from "~/lib/email-templates";
import {
  formatBytes,
  useFileUpload,
  type FileWithPreview,
} from "~/hooks/use-file-upload";

function filledTemplateBody(
  body: string,
  vars: EmailTemplateVars,
  logoWidth: number,
): string {
  return buildOutboundTemplateHtml(applyEmailTemplate(body, vars), {
    footerImageWidth: logoWidth,
    footerImageDataUri: vars.footerImage,
  });
}

const RECIPIENT_LABELS: Record<EmailSendRecipient, string> = {
  broker: "broker",
  insurer: "insurer",
};

const EXTRA_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,image/png,image/jpeg";
const EXTRA_MAX_FILES = 10;
const EXTRA_MAX_SIZE = 5 * 1024 * 1024;

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function isBrowserFile(file: FileWithPreview["file"]): file is File {
  return typeof File !== "undefined" && file instanceof File;
}

export function EmailDocumentsDialog({
  open,
  onOpenChange,
  policyId,
  documents,
  policyNumber,
  clientName = "",
  brokerName = "",
  brokerEmail = "",
  recipientType,
  template,
  defaultTo = "",
  templateVars,
  footerImageDataUri = "",
  footerImageWidth,
  emailDirectory = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: number;
  documents: PolicyDocument[];
  policyNumber: string;
  clientName?: string;
  brokerName?: string;
  brokerEmail?: string;
  recipientType: EmailSendRecipient;
  template: EmailTemplate;
  defaultTo?: string;
  /** Extra merge fields (cover type, insured, account manager, …). */
  templateVars?: EmailTemplateVars;
  /** DB-stored footer image data URI (blob). */
  footerImageDataUri?: string;
  /** Logo width in px (Settings → Email Footer Image scale). */
  footerImageWidth?: number;
  /** Users, ARs, and clients for To/Cc autocomplete. */
  emailDirectory?: EmailDirectoryEntry[];
}) {
  const logoWidth = footerImageWidth ?? EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT;
  const useTemplateHtml = isEmailHtmlBody(template.body);
  const vars: EmailTemplateVars = {
    clientName,
    policyNumber,
    brokerName,
    ...templateVars,
    footerImage: footerImageDataUri || templateVars?.footerImage || "",
  };
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(
    applyEmailTemplate(template.subject, vars),
  );
  const [editorContent, setEditorContent] = useState(() =>
    useTemplateHtml
      ? filledTemplateBody(template.body, vars, logoWidth)
      : ensureEmailEditorHtml(applyEmailTemplate(template.body, vars)),
  );
  const [editorKey, setEditorKey] = useState(0);
  const [attachments, setAttachments] = useState(documents);
  const [sending, setSending] = useState(false);
  const editorHandleRef = useRef<EmailRichEditorHandle>(null);

  const [
    { files: extraFiles, isDragging },
    {
      removeFile,
      clearFiles,
      clearErrors,
      openFileDialog,
      getInputProps,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
    },
  ] = useFileUpload({
    multiple: true,
    maxFiles: EXTRA_MAX_FILES,
    maxSize: EXTRA_MAX_SIZE,
    accept: EXTRA_ACCEPT,
    onError: (errors) => {
      if (errors[0]) toast.error(errors[0]);
    },
  });

  const directoryOptions = useMemo(() => {
    const extras: EmailDirectoryEntry[] = [];
    const seen = new Set(
      emailDirectory.map((entry) => entry.email.trim().toLowerCase()),
    );
    for (const [email, name, kind] of [
      [defaultTo, brokerName || "Default", "ar"],
      [brokerEmail, brokerName || "Broker", "ar"],
      [template.toEmail, "Insurer", "ar"],
    ] as const) {
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes("@") || seen.has(normalized)) continue;
      seen.add(normalized);
      extras.push({ email: normalized, name, kind });
    }
    return [...extras, ...emailDirectory];
  }, [emailDirectory, defaultTo, brokerEmail, brokerName, template.toEmail]);

  const attachmentCount = attachments.length + extraFiles.length;

  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;
    const nextVars: EmailTemplateVars = {
      clientName,
      policyNumber,
      brokerName,
      ...templateVars,
      footerImage: footerImageDataUri || templateVars?.footerImage || "",
    };
    setTo(defaultTo);
    setCc("");
    setSubject(applyEmailTemplate(template.subject, nextVars));
    setEditorContent(
      isEmailHtmlBody(template.body)
        ? filledTemplateBody(template.body, nextVars, logoWidth)
        : ensureEmailEditorHtml(applyEmailTemplate(template.body, nextVars)),
    );
    setEditorKey((key) => key + 1);
    setAttachments(documents);
    setSending(false);
    clearFiles();
    clearErrors();
  }, [
    open,
    defaultTo,
    policyNumber,
    clientName,
    brokerName,
    documents,
    template.subject,
    template.body,
    templateVars,
    footerImageDataUri,
    logoWidth,
    clearFiles,
    clearErrors,
  ]);

  function removeAttachment(id: number) {
    setAttachments((prev) => prev.filter((doc) => doc.policyDocumentId !== id));
  }

  async function handleSend() {
    const recipient = to.trim();
    if (!recipient) {
      toast.error("Enter at least one recipient email.");
      return;
    }
    if (attachmentCount === 0) {
      toast.error("Attach at least one document.");
      return;
    }
    if (!Number.isFinite(policyId) || policyId <= 0) {
      toast.error("Policy is missing. Reload and try again.");
      return;
    }

    setSending(true);
    try {
      let html: string;
      let text: string;
      if (useTemplateHtml) {
        // Match Settings → Email templates Preview (preserve ASCX styling).
        html = buildOutboundTemplateHtml(editorContent, {
          footerImageDataUri: vars.footerImage,
          footerImageWidth: logoWidth,
        });
        text = htmlToPlainText(html);
      } else {
        const exported = await editorHandleRef.current?.getEmail();
        const documentHtml =
          editorHandleRef.current?.getDocumentHtml().trim() || editorContent;
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
        if (!isBrowserFile(item.file)) continue;
        extraAttachments.push({
          filename: item.file.name,
          contentBase64: await fileToBase64(item.file),
          contentType: item.file.type || undefined,
        });
      }

      const response = await fetch(
        `/api/policies/${policyId}/email-documents`,
        {
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
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Could not send email. Try again.");
      }
      onOpenChange(false);
      window.setTimeout(() => {
        toast.success("Email sent", {
          description: `Sent to ${recipient} · ${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"} (${RECIPIENT_LABELS[recipientType]})`,
          duration: 5000,
        });
      }, 0);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not send email. Try again.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        className="flex max-h-[92vh] flex-col gap-0 overflow-hidden sm:max-w-5xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>Email {RECIPIENT_LABELS[recipientType]}</span>
            <Badge variant="warning-light" size="sm" radius="full">
              {EMAIL_TEMPLATE_META[template.recipientType].policyTag ??
                EMAIL_TEMPLATE_META[template.recipientType].title}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-1">
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            <div className="flex items-center gap-3 px-3">
              <label
                htmlFor="email-to"
                className="w-16 shrink-0 text-sm text-muted-foreground"
              >
                To
              </label>
              <EmailRecipientsInput
                id="email-to"
                aria-label="To"
                value={to}
                onChange={setTo}
                options={directoryOptions}
                placeholder={
                  recipientType === "broker" && brokerEmail
                    ? `${brokerEmail}; …`
                    : "name@example.com; …"
                }
              />
            </div>
            <div className="flex items-center gap-3 px-3">
              <label
                htmlFor="email-cc"
                className="w-16 shrink-0 text-sm text-muted-foreground"
              >
                Cc
              </label>
              <EmailRecipientsInput
                id="email-cc"
                aria-label="Cc"
                value={cc}
                onChange={setCc}
                options={directoryOptions}
                placeholder=""
              />
            </div>
            <div className="flex items-center gap-3 px-3">
              <label
                htmlFor="email-subject"
                className="w-16 shrink-0 text-sm text-muted-foreground"
              >
                Subject
              </label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Subject"
                className="min-w-0 flex-1 rounded-none border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="flex min-w-0 flex-col gap-2">
              <FieldLabel>Message</FieldLabel>
              {useTemplateHtml ? (
                <div className="h-[min(28rem,50vh)] overflow-hidden rounded-md border border-border bg-white">
                  <EmailDocumentFrame
                    title="Email message"
                    html={editorContent}
                    editable
                    reloadKey={editorKey}
                    onHtmlChange={setEditorContent}
                    className="h-full min-h-[min(28rem,50vh)]"
                  />
                </div>
              ) : (
                <EmailRichEditor
                  ref={editorHandleRef}
                  content={editorContent}
                  contentKey={`compose-${recipientType}-${editorKey}`}
                  heightClassName="h-[min(28rem,50vh)]"
                  showInspector={false}
                />
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <FieldLabel>Attachments ({attachmentCount})</FieldLabel>
              <div className="flex h-[min(28rem,50vh)] flex-col overflow-hidden rounded-md border border-border bg-muted/20">
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  {attachmentCount === 0 ? (
                    <p className="px-1 py-2 text-sm text-muted-foreground">
                      No documents attached. Select policy documents or add
                      files below.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {attachments.map((doc) => (
                        <li
                          key={doc.policyDocumentId}
                          className="flex items-start gap-2 rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-foreground/10"
                        >
                          <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 break-words">
                            {doc.filename}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="shrink-0"
                            aria-label={`Remove ${doc.name}`}
                            onClick={() =>
                              removeAttachment(doc.policyDocumentId)
                            }
                          >
                            <XIcon />
                          </Button>
                        </li>
                      ))}
                      {extraFiles.map((item) => {
                        const name = item.file.name;
                        const size =
                          "size" in item.file ? item.file.size : undefined;
                        return (
                          <li
                            key={item.id}
                            className="flex items-start gap-2 rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-foreground/10"
                          >
                            <PaperclipIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 break-words">
                              <span className="block">{name}</span>
                              {typeof size === "number" ? (
                                <span className="text-xs text-muted-foreground">
                                  {formatBytes(size)}
                                </span>
                              ) : null}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="shrink-0"
                              aria-label={`Remove ${name}`}
                              onClick={() => removeFile(item.id)}
                            >
                              <XIcon />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div
                  className={
                    isDragging
                      ? "border-t border-primary/40 bg-primary/5 p-2"
                      : "border-t border-border p-2"
                  }
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input {...getInputProps()} className="sr-only" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={openFileDialog}
                    disabled={sending || extraFiles.length >= EXTRA_MAX_FILES}
                  >
                    <PaperclipIcon data-icon="inline-start" />
                    Add files
                  </Button>
                  <p className="mt-1.5 text-center text-[0.7rem] text-muted-foreground">
                    PDF, images, Office · max {EXTRA_MAX_FILES} ·{" "}
                    {formatBytes(EXTRA_MAX_SIZE)} each
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:items-center sm:justify-between">
          <DialogDescription className="text-left text-xs sm:max-w-[55%]">
            {useTemplateHtml ? (
              "Message uses the email template styling. Edit text in place; To, Cc, and Subject stay editable above."
            ) : (
              <>
                Type <kbd className="rounded border px-1 text-[0.7rem]">/</kbd>{" "}
                to insert blocks; select text for formatting.
              </>
            )}
          </DialogDescription>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <LoadingButton
              type="button"
              onClick={() => void handleSend()}
              loading={sending}
              loadingLabel="Sending…"
            >
              <MailIcon data-icon="inline-start" />
              Send
            </LoadingButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
