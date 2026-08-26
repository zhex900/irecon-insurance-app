import { FileTextIcon, MailIcon, PaperclipIcon, XIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmailDocumentFrame } from "~/components/email/email-document-frame";
import {
  EMAIL_DOCUMENTS_EXTRA_ACCEPT,
  EMAIL_DOCUMENTS_EXTRA_MAX_FILES,
  EMAIL_DOCUMENTS_EXTRA_MAX_SIZE,
  EMAIL_DOCUMENTS_RECIPIENT_LABELS,
  filledEmailDocumentsTemplateBody,
} from "~/components/email/email-documents-dialog-helpers";
import { sendPolicyDocumentsEmail } from "~/components/email/email-documents-send";
import { EmailRecipientsInput } from "~/components/email/email-recipients-input";
import {
  EmailRichEditor,
  type EmailRichEditorHandle,
} from "~/components/email/email-rich-editor";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
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
import { LoadingButton } from "~/components/ui/loading-button";
import { Skeleton } from "~/components/ui/skeleton";
import { formatBytes } from "~/hooks/utilities";
import {
  type FileWithPreview,
  useFileUploadFixed,
} from "~/hooks/utilities/use-file-upload-fixed";
import type { PolicyDocument } from "~/lib/db/types";
import type { EmailDirectoryEntry } from "~/lib/email/directory";
import { EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT } from "~/lib/email/footer-display";
import {
  applyEmailTemplate,
  EMAIL_TEMPLATE_META,
  type EmailSendRecipient,
  type EmailTemplate,
  type EmailTemplateVars,
  ensureEmailEditorHtml,
  isEmailHtmlBody,
} from "~/lib/email/templates";
import { policyDocumentRowKey } from "~/lib/services/policy/documents/merge";

function EmailDocumentsDialogSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-1"
      role="status"
      aria-label="Loading email compose"
    >
      <div className="flex flex-col divide-y divide-border rounded-md border border-border">
        {(["To", "Cc", "Subject"] as const).map((label) => (
          <div key={label} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-16 shrink-0 text-sm text-muted-foreground">
              {label}
            </span>
            <Skeleton className="h-9 min-w-0 flex-1" />
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-[min(28rem,50vh)] min-h-64 w-full rounded-md" />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-[min(28rem,50vh)] min-h-64 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

type EmailDocumentsDialogFormProps = {
  onOpenChange: (open: boolean) => void;
  policyId: string;
  documents: PolicyDocument[];
  policyNumber: string;
  clientName?: string;
  brokerName?: string;
  brokerEmail?: string;
  recipientType: EmailSendRecipient;
  template: EmailTemplate;
  defaultTo?: string;
  templateVars?: EmailTemplateVars;
  footerImageDataUri?: string;
  footerImageWidth?: number;
  emailDirectory?: EmailDirectoryEntry[];
};

function EmailDocumentsDialogForm({
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
}: EmailDocumentsDialogFormProps) {
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
      ? filledEmailDocumentsTemplateBody(template.body, vars, logoWidth)
      : ensureEmailEditorHtml(applyEmailTemplate(template.body, vars)),
  );
  const [attachments, setAttachments] = useState(documents);
  const [sending, setSending] = useState(false);
  const editorHandleRef = useRef<EmailRichEditorHandle>(null);
  const [extraFiles, setExtraFiles] = useState<FileWithPreview[]>([]);

  const {
    isDragging,
    openFileDialog,
    getInputProps,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useFileUploadFixed({
    multiple: true,
    maxFiles: EMAIL_DOCUMENTS_EXTRA_MAX_FILES,
    maxSize: EMAIL_DOCUMENTS_EXTRA_MAX_SIZE,
    accept: EMAIL_DOCUMENTS_EXTRA_ACCEPT,
    onFilesAdded: (added: FileWithPreview[]) => {
      setExtraFiles((prev) => [...prev, ...added]);
    },
    onError: (errors: string[]) => {
      if (errors[0]) toast.error(errors[0]);
    },
  });

  const removeFile = useCallback((id: string) => {
    setExtraFiles((prev) => prev.filter((file) => file.id !== id));
  }, []);

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

  function removeAttachment(id: string) {
    setAttachments((prev) =>
      prev.filter((doc) => policyDocumentRowKey(doc) !== id),
    );
  }

  async function handleSend() {
    setSending(true);
    try {
      await sendPolicyDocumentsEmail({
        policyId,
        attachments,
        extraFiles,
        to,
        cc,
        subject,
        useTemplateHtml,
        editorContent,
        editorHandle: editorHandleRef.current,
        vars,
        logoWidth,
        recipientType,
        onSuccess: () => onOpenChange(false),
      });
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
    <>
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
                  reloadKey={0}
                  onHtmlChange={setEditorContent}
                  className="h-full min-h-[min(28rem,50vh)]"
                />
              </div>
            ) : (
              <EmailRichEditor
                ref={editorHandleRef}
                content={editorContent}
                contentKey={`compose-${recipientType}`}
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
                    No documents attached. Select policy documents or add files
                    below.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {attachments.map((doc) => {
                      const rowKey = policyDocumentRowKey(doc);
                      return (
                        <li
                          key={rowKey}
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
                            onClick={() => removeAttachment(rowKey)}
                          >
                            <XIcon />
                          </Button>
                        </li>
                      );
                    })}
                    {extraFiles.map((item: FileWithPreview) => {
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
                  disabled={
                    sending ||
                    extraFiles.length >= EMAIL_DOCUMENTS_EXTRA_MAX_FILES
                  }
                >
                  <PaperclipIcon data-icon="inline-start" />
                  Add files
                </Button>
                <p className="mt-1.5 text-center text-[0.7rem] text-muted-foreground">
                  PDF, images, Office · max {EMAIL_DOCUMENTS_EXTRA_MAX_FILES} ·{" "}
                  {formatBytes(EMAIL_DOCUMENTS_EXTRA_MAX_SIZE)} each
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
              Type <kbd className="rounded border px-1 text-[0.7rem]">/</kbd> to
              insert blocks; select text for formatting.
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
          >
            <MailIcon data-icon="inline-start" />
            Send
          </LoadingButton>
        </div>
      </DialogFooter>
    </>
  );
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
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: string;
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
  /** Compose payload still loading (templates, directory, footer). */
  loading?: boolean;
}) {
  const showSkeleton = open && loading;
  const formKey = useMemo(
    () =>
      [
        recipientType,
        defaultTo,
        template.subject,
        template.body,
        policyNumber,
        footerImageDataUri,
        documents.map((doc) => policyDocumentRowKey(doc)).join(","),
      ].join("|"),
    [
      recipientType,
      defaultTo,
      template.subject,
      template.body,
      policyNumber,
      footerImageDataUri,
      documents,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        className="flex max-h-[92vh] flex-col gap-0 overflow-hidden sm:max-w-5xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>Email {EMAIL_DOCUMENTS_RECIPIENT_LABELS[recipientType]}</span>
            <Badge variant="warning-light" size="sm" radius="full">
              {EMAIL_TEMPLATE_META[template.recipientType].policyTag ??
                EMAIL_TEMPLATE_META[template.recipientType].title}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {showSkeleton ? (
          <EmailDocumentsDialogSkeleton />
        ) : (
          <EmailDocumentsDialogForm
            key={formKey}
            onOpenChange={onOpenChange}
            policyId={policyId}
            documents={documents}
            policyNumber={policyNumber}
            clientName={clientName}
            brokerName={brokerName}
            brokerEmail={brokerEmail}
            recipientType={recipientType}
            template={template}
            defaultTo={defaultTo}
            templateVars={templateVars}
            footerImageDataUri={footerImageDataUri}
            footerImageWidth={footerImageWidth}
            emailDirectory={emailDirectory}
          />
        )}

        {showSkeleton ? (
          <DialogFooter className="sm:items-center sm:justify-between">
            <Skeleton className="hidden h-3 w-48 max-w-[55%] sm:block" />
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="button" disabled>
                <MailIcon data-icon="inline-start" />
                Send
              </Button>
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
