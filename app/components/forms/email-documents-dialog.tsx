import { useEffect, useRef, useState } from "react";
import { FileTextIcon, MailIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
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
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import type { PolicyDocument } from "~/lib/db/types";
import {
  applyEmailTemplate,
  type EmailRecipientType,
  type EmailTemplate,
} from "~/lib/email-templates";

const RECIPIENT_LABELS: Record<EmailRecipientType, string> = {
  broker: "broker",
  insurer: "insurer",
};

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyId: number;
  documents: PolicyDocument[];
  policyNumber: string;
  clientName?: string;
  brokerName?: string;
  brokerEmail?: string;
  recipientType: EmailRecipientType;
  template: EmailTemplate;
  defaultTo?: string;
}) {
  const vars = {
    clientName,
    policyNumber,
    brokerName,
  };
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(
    applyEmailTemplate(template.subject, vars),
  );
  const [body, setBody] = useState(applyEmailTemplate(template.body, vars));
  const [attachments, setAttachments] = useState(documents);
  const [sending, setSending] = useState(false);

  const toSuggestions = [
    ...new Set(
      [defaultTo, brokerEmail, template.toEmail]
        .map((email) => email.trim())
        .filter(Boolean),
    ),
  ];
  const toListId = "email-documents-to-suggestions";

  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;
    const nextVars = { clientName, policyNumber, brokerName };
    setTo(defaultTo);
    setCc("");
    setSubject(applyEmailTemplate(template.subject, nextVars));
    setBody(applyEmailTemplate(template.body, nextVars));
    setAttachments(documents);
    setSending(false);
  }, [
    open,
    defaultTo,
    policyNumber,
    clientName,
    brokerName,
    documents,
    template.subject,
    template.body,
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
    if (attachments.length === 0) {
      toast.error("Attach at least one document.");
      return;
    }
    if (!Number.isFinite(policyId) || policyId <= 0) {
      toast.error("Policy is missing. Reload and try again.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch(
        `/api/policies/${policyId}/email-documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            documentIds: attachments.map((doc) => doc.policyDocumentId),
            to: recipient,
            cc: cc.trim() || undefined,
            subject: subject.trim(),
            body,
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
      toast.success(`Email sent to ${recipient}`, {
        description: `${attachments.length} attachment${attachments.length === 1 ? "" : "s"} · ${RECIPIENT_LABELS[recipientType]}`,
      });
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Email {RECIPIENT_LABELS[recipientType]}</DialogTitle>
          <DialogDescription>
            Compose a message and send the selected PDFs to the{" "}
            {RECIPIENT_LABELS[recipientType]}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="email-to">To</FieldLabel>
            <Input
              id="email-to"
              type="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder={
                recipientType === "broker" && brokerEmail
                  ? brokerEmail
                  : "recipient@example.com"
              }
              list={toSuggestions.length > 0 ? toListId : undefined}
              autoComplete="off"
            />
            {toSuggestions.length > 0 ? (
              <datalist id={toListId}>
                {toSuggestions.map((email) => (
                  <option key={email} value={email}>
                    {brokerEmail === email && brokerName
                      ? `${brokerName} (broker)`
                      : email}
                  </option>
                ))}
              </datalist>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="email-cc">Cc</FieldLabel>
            <Input
              id="email-cc"
              type="email"
              value={cc}
              onChange={(event) => setCc(event.target.value)}
              placeholder="optional"
              autoComplete="email"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email-subject">Subject</FieldLabel>
            <Input
              id="email-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email-body">Message</FieldLabel>
            <Textarea
              id="email-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              className="min-h-40"
            />
          </Field>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Attachments ({attachments.length})
            </p>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No documents attached.
              </p>
            ) : (
              <ul className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
                {attachments.map((doc) => (
                  <li
                    key={doc.policyDocumentId}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {doc.filename}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${doc.name}`}
                      onClick={() => removeAttachment(doc.policyDocumentId)}
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
