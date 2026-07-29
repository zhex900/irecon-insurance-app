import { useEffect, useRef, useState, type FormEvent } from "react";
import { redirect, useFetcher } from "react-router";
import { EyeIcon, Redo2Icon, SendIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "~/components/layout/app-layout";
import {
  EmailRichEditor,
  type EmailRichEditorHandle,
} from "~/components/forms/email-rich-editor";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { requireAuth } from "~/lib/auth/session.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import { pageTitle } from "~/lib/brand";
import {
  EMAIL_TEMPLATE_META,
  EMAIL_TEMPLATE_PLACEHOLDERS,
  applyEmailTemplate,
  emailTemplatePreviewVars,
  ensureEmailEditorHtml,
  ensureEmailTableBorders,
  extractEmailFooterImage,
  htmlToPlainText,
  injectEmailFooterImage,
  preferEmailHtml,
} from "~/lib/email-templates";
import { writeAuditLog } from "~/lib/services/audit/service";
import { sendEmail } from "~/lib/services/email/resend.server";
import { getEmailFooterDataUri } from "~/lib/services/email/footer-image";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import {
  EMAIL_TEMPLATE_KEYS,
  getEmailTemplate,
  resetEmailTemplate,
  saveEmailTemplate,
  type EmailTemplateKey,
} from "~/lib/services/email/templates";
import type { Route } from "./+types/email-templates.$key";

type TemplateSnapshot = { subject: string; body: string };

function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function meta() {
  return [{ title: pageTitle("Email Template") }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const emailTemplatesEnabled = await isFeatureEnabled("email_templates");
  if (!emailTemplatesEnabled && !isSuperAdmin(viewer)) {
    throw redirect("/settings");
  }

  const key = String(params.key ?? "");
  if (!isEmailTemplateKey(key)) {
    throw redirect("/settings/email-templates");
  }

  const template = await getEmailTemplate(key);
  const meta = EMAIL_TEMPLATE_META[key];

  return {
    template,
    meta,
    canEdit: isSuperAdmin(viewer),
    emailTemplatesEnabled,
    viewerEmail: viewer.email,
    footerImageDataUri: await getEmailFooterDataUri(),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const viewer = await requireAuth(request);
  if (!isSuperAdmin(viewer)) {
    return {
      ok: false as const,
      error: "Only super-admins can change email templates.",
    };
  }

  const key = String(params.key ?? "");
  if (!isEmailTemplateKey(key)) {
    return { ok: false as const, error: "Unknown template." };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save");

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
        error:
          error instanceof Error
            ? error.message
            : "Could not send preview email.",
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

export default function SettingsEmailTemplateEditorRoute({
  loaderData,
}: Route.ComponentProps) {
  const { template, meta, canEdit, viewerEmail, footerImageDataUri } =
    loaderData;
  const fetcher = useFetcher<typeof action>();
  const handledDataRef = useRef<typeof fetcher.data>(undefined);
  const editorRef = useRef<EmailRichEditorHandle>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const subjectSelectionRef = useRef<{ start: number; end: number } | null>(
    null,
  );
  const historyRef = useRef<TemplateSnapshot[]>([]);
  const historyIndexRef = useRef(0);
  const skipHistoryRef = useRef(false);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [subject, setSubject] = useState(template.subject);
  const [editorContent, setEditorContent] = useState(() =>
    ensureEmailEditorHtml(
      injectEmailFooterImage(template.body, footerImageDataUri),
    ),
  );
  const [editorKey, setEditorKey] = useState(0);
  const [toEmail, setToEmail] = useState(template.toEmail);
  const [insertTarget, setInsertTarget] = useState<"subject" | "body">("body");
  const [canUndoHistory, setCanUndoHistory] = useState(false);
  const [canRedoHistory, setCanRedoHistory] = useState(false);
  const [canUndoEditor, setCanUndoEditor] = useState(false);
  const [canRedoEditor, setCanRedoEditor] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewTo, setPreviewTo] = useState(viewerEmail);
  const busy = fetcher.state !== "idle";
  const sendingPreview =
    busy && String(fetcher.formData?.get("intent") ?? "") === "send-preview";
  const showToEmail = template.recipientType === "insurer";

  function syncHistoryButtons() {
    setCanUndoHistory(historyIndexRef.current > 0);
    setCanRedoHistory(historyIndexRef.current < historyRef.current.length - 1);
    setCanUndoEditor(Boolean(editorRef.current?.canUndo()));
    setCanRedoEditor(Boolean(editorRef.current?.canRedo()));
  }

  function currentSnapshot(): TemplateSnapshot {
    return {
      subject,
      body: editorRef.current?.getDocumentHtml() ?? editorContent,
    };
  }

  function pushHistory(snapshot?: TemplateSnapshot) {
    if (skipHistoryRef.current) return;
    const next = snapshot ?? currentSnapshot();
    const current = historyRef.current[historyIndexRef.current];
    if (
      current &&
      current.subject === next.subject &&
      current.body === next.body
    ) {
      return;
    }
    const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);
    truncated.push(next);
    // Cap history length.
    if (truncated.length > 50) truncated.shift();
    historyRef.current = truncated;
    historyIndexRef.current = truncated.length - 1;
    syncHistoryButtons();
  }

  function scheduleHistoryPush() {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      pushHistory();
      syncHistoryButtons();
    }, 600);
  }

  function applySnapshot(snapshot: TemplateSnapshot) {
    skipHistoryRef.current = true;
    setSubject(snapshot.subject);
    setEditorContent(ensureEmailEditorHtml(snapshot.body));
    setEditorKey((key) => key + 1);
    requestAnimationFrame(() => {
      skipHistoryRef.current = false;
      syncHistoryButtons();
    });
  }

  function handleUndo() {
    if (!canEdit) return;
    if (editorRef.current?.undo()) {
      scheduleHistoryPush();
      syncHistoryButtons();
      return;
    }
    if (historyIndexRef.current <= 0) return;
    // Capture live state before stepping back if we're at the tip.
    if (historyIndexRef.current === historyRef.current.length - 1) {
      pushHistory();
    }
    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (snapshot) applySnapshot(snapshot);
  }

  function handleRedo() {
    if (!canEdit) return;
    if (editorRef.current?.redo()) {
      scheduleHistoryPush();
      syncHistoryButtons();
      return;
    }
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (snapshot) applySnapshot(snapshot);
  }

  function insertPlaceholder(token: string, key: string) {
    if (!canEdit) return;
    pushHistory();
    const content =
      key === "footerImage" && footerImageDataUri
        ? `<img src="${footerImageDataUri}" alt="Irecon Advisernet Logo" width="390">`
        : token;
    if (insertTarget === "subject") {
      if (key === "footerImage") {
        toast.error("Insert the footer image into the message body.");
        return;
      }
      const input = subjectInputRef.current;
      const selection =
        subjectSelectionRef.current ??
        (input
          ? {
              start: input.selectionStart ?? subject.length,
              end: input.selectionEnd ?? subject.length,
            }
          : { start: subject.length, end: subject.length });
      const next =
        subject.slice(0, selection.start) +
        content +
        subject.slice(selection.end);
      setSubject(next);
      const cursor = selection.start + content.length;
      subjectSelectionRef.current = { start: cursor, end: cursor };
      requestAnimationFrame(() => {
        const el = subjectInputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(cursor, cursor);
      });
      scheduleHistoryPush();
      return;
    }
    editorRef.current?.insertContent(content);
    scheduleHistoryPush();
  }

  async function openPreview() {
    const vars = emailTemplatePreviewVars({
      footerImageDataUri,
    });
    const sourceHtml =
      editorRef.current?.getDocumentHtml().trim() || editorContent;
    const fromDoc = applyEmailTemplate(sourceHtml, vars);
    let emailHtml = preferEmailHtml({
      documentHtml: fromDoc,
      footerImageDataUri,
    });
    let emailText = htmlToPlainText(emailHtml);
    try {
      const rendered = await editorRef.current?.getEmail();
      if (rendered?.html?.trim()) {
        emailHtml = preferEmailHtml({
          documentHtml: fromDoc,
          exportedHtml: applyEmailTemplate(rendered.html, vars),
          footerImageDataUri,
        });
        emailText = rendered.text
          ? applyEmailTemplate(rendered.text, vars)
          : htmlToPlainText(emailHtml);
      }
    } catch {
      // Fall back to TipTap document HTML.
    }
    setPreviewSubject(applyEmailTemplate(subject, vars));
    setPreviewHtml(emailHtml);
    setPreviewText(emailText);
    setPreviewTo(viewerEmail);
    setPreviewOpen(true);
  }

  async function sendPreviewEmail() {
    const formData = new FormData();
    formData.set("intent", "send-preview");
    formData.set("to", previewTo);
    formData.set("subject", previewSubject);
    formData.set("html", previewHtml);
    formData.set("text", previewText);
    fetcher.submit(formData, { method: "post" });
  }

  useEffect(() => {
    const body = ensureEmailEditorHtml(
      injectEmailFooterImage(template.body, footerImageDataUri),
    );
    historyRef.current = [
      {
        subject: template.subject,
        body,
      },
    ];
    historyIndexRef.current = 0;
    // Defer so we don't cascade setState synchronously inside the effect.
    queueMicrotask(() => {
      setSubject(template.subject);
      setEditorContent(body);
      setEditorKey((key) => key + 1);
      setToEmail(template.toEmail);
      syncHistoryButtons();
    });
  }, [
    template.recipientType,
    template.subject,
    template.body,
    template.toEmail,
    footerImageDataUri,
  ]);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (handledDataRef.current === fetcher.data) return;
    handledDataRef.current = fetcher.data;
    const data = handledDataRef.current;

    if (data.ok) {
      if ("sent" in data && data.sent) {
        setPreviewOpen(false);
        toast.success(`Preview email sent to ${data.to}`);
        return;
      }
      if (!("template" in data) || !data.template) return;
      const saved = data.template;
      if (data.reset) {
        const body = ensureEmailEditorHtml(
          injectEmailFooterImage(saved.body, footerImageDataUri),
        );
        setSubject(saved.subject);
        setEditorContent(body);
        setEditorKey((key) => key + 1);
        setToEmail(saved.toEmail);
        historyRef.current = [{ subject: saved.subject, body }];
        historyIndexRef.current = 0;
        syncHistoryButtons();
        toast.success(
          meta.sourceAscx
            ? `Loaded ${meta.sourceAscx}`
            : "Reset to default template",
        );
        return;
      }
      // Sync editor to what was persisted (normalized borders / formatting).
      setSubject(saved.subject);
      setToEmail(saved.toEmail);
      const body = ensureEmailEditorHtml(
        injectEmailFooterImage(saved.body, footerImageDataUri),
      );
      setEditorContent(body);
      setEditorKey((key) => key + 1);
      historyRef.current = [{ subject: saved.subject, body }];
      historyIndexRef.current = 0;
      syncHistoryButtons();
      toast.success(`${meta.title} saved`, {
        description:
          "Subject, body, and formatting (including borders) were saved.",
      });
    } else if ("error" in data) {
      toast.error(data.error);
    }
  }, [
    fetcher.state,
    fetcher.data,
    meta.title,
    meta.sourceAscx,
    footerImageDataUri,
  ]);

  useEffect(() => {
    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const rawBody = editorRef.current?.getDocumentHtml().trim() ?? "";
    const body = ensureEmailTableBorders(
      extractEmailFooterImage(rawBody, footerImageDataUri),
    ).trim();
    if (!subject.trim()) {
      toast.error("Subject is required.");
      return;
    }
    if (!body) {
      toast.error("Message body is required.");
      return;
    }
    const formData = new FormData();
    formData.set("intent", "save");
    formData.set("subject", subject);
    formData.set("body", body);
    formData.set("toEmail", showToEmail ? toEmail : "");
    fetcher.submit(formData, { method: "post" });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={meta.title}
        description={meta?.description || ""}
        breadcrumbs={[
          { label: "Settings", to: "/settings", reloadDocument: true },
          {
            label: "Email Templates",
            to: "/settings/email-templates",
            reloadDocument: true,
          },
          { label: meta.title },
        ]}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {showToEmail ? (
          <Field className="max-w-5xl">
            <FieldLabel htmlFor={`${template.recipientType}-to`}>
              Insurer email
            </FieldLabel>
            <Input
              id={`${template.recipientType}-to`}
              type="email"
              value={toEmail}
              onChange={(event) => setToEmail(event.target.value)}
              placeholder="underwriting@insurer.com"
              autoComplete="email"
              required
              disabled={!canEdit}
              readOnly={!canEdit}
            />
          </Field>
        ) : null}
        <Field className="max-w-5xl">
          <FieldLabel htmlFor={`${template.recipientType}-subject`}>
            Subject
          </FieldLabel>
          <Input
            ref={subjectInputRef}
            id={`${template.recipientType}-subject`}
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              scheduleHistoryPush();
            }}
            onFocus={() => setInsertTarget("subject")}
            onSelect={(event) => {
              const el = event.currentTarget;
              subjectSelectionRef.current = {
                start: el.selectionStart ?? 0,
                end: el.selectionEnd ?? 0,
              };
            }}
            onBlur={(event) => {
              const el = event.currentTarget;
              subjectSelectionRef.current = {
                start: el.selectionStart ?? subject.length,
                end: el.selectionEnd ?? subject.length,
              };
              pushHistory();
            }}
            required
            disabled={!canEdit}
            readOnly={!canEdit}
          />
        </Field>
        <Field>
          <div className="grid items-start gap-x-4 gap-y-1.5 lg:grid-cols-[minmax(0,1fr)_14rem] xl:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel>Message</FieldLabel>
              <div className="flex flex-wrap gap-1">
                {canEdit ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUndo}
                      disabled={!canUndoHistory && !canUndoEditor}
                      title="Undo"
                    >
                      <Undo2Icon data-icon="inline-start" />
                      Undo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRedo}
                      disabled={!canRedoHistory && !canRedoEditor}
                      title="Redo"
                    >
                      <Redo2Icon data-icon="inline-start" />
                      Redo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void openPreview()}
                    >
                      <EyeIcon data-icon="inline-start" />
                      Preview
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.location.assign("/settings/email-templates");
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <LoadingButton
                      type="submit"
                      size="sm"
                      loading={busy && !sendingPreview}
                      loadingLabel="Saving…"
                    >
                      Save
                    </LoadingButton>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void openPreview()}
                    >
                      <EyeIcon data-icon="inline-start" />
                      Preview
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.location.assign("/settings/email-templates");
                      }}
                    >
                      Back
                    </Button>
                  </>
                )}
              </div>
            </div>
            {/* Keeps Placeholders on the same row as the editor on large screens. */}
            <div className="hidden lg:block" aria-hidden />

            <div
              onFocusCapture={() => setInsertTarget("body")}
              onMouseDown={() => setInsertTarget("body")}
            >
              <EmailRichEditor
                ref={editorRef}
                content={editorContent}
                contentKey={`${template.recipientType}-${editorKey}`}
                editable={canEdit}
                heightClassName="h-[min(36rem,65vh)]"
                onDocumentUpdate={() => {
                  scheduleHistoryPush();
                  syncHistoryButtons();
                }}
              />
            </div>

            <Card
              size="sm"
              className="flex h-[min(36rem,65vh)] flex-col overflow-hidden lg:sticky lg:top-20"
            >
              <CardHeader className="shrink-0 gap-1">
                <CardTitle>Placeholders</CardTitle>
                <CardDescription>
                  Click a tag to insert at the cursor in the{" "}
                  {insertTarget === "subject" ? "subject" : "message"}.
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-1.5">
                  {EMAIL_TEMPLATE_PLACEHOLDERS.map(({ key, token }) => (
                    <Badge
                      key={key}
                      variant="warning-light"
                      size="sm"
                      radius="full"
                      render={
                        <button
                          type="button"
                          disabled={!canEdit}
                          onMouseDown={(event) => {
                            // Keep subject/editor selection when clicking tags.
                            event.preventDefault();
                          }}
                          onClick={() => insertPlaceholder(token, key)}
                          title={
                            key === "footerImage"
                              ? "Insert footer image (database blob)"
                              : `Insert ${token}`
                          }
                        />
                      }
                      className={
                        canEdit
                          ? "w-fit cursor-pointer font-mono hover:bg-warning/20"
                          : "w-fit cursor-default font-mono opacity-60"
                      }
                    >
                      {token}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </Field>
      </form>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="gap-1 border-b p-4">
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <div className="flex flex-col divide-y divide-border rounded-md border border-border">
              <div className="flex items-center gap-3 px-3">
                <label
                  htmlFor="preview-to"
                  className="w-16 shrink-0 text-sm text-muted-foreground"
                >
                  To
                </label>
                <Input
                  id="preview-to"
                  type="email"
                  value={previewTo}
                  onChange={(event) => setPreviewTo(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="min-w-0 flex-1 rounded-none border-0 px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="w-16 shrink-0 text-sm text-muted-foreground">
                  Subject
                </span>
                <p className="min-w-0 flex-1 truncate text-sm">
                  {previewSubject || "—"}
                </p>
              </div>
            </div>
            <div className="overflow-auto rounded-lg border bg-white">
              <div
                title="Email Preview"
                className="email-template-preview h-[min(28rem,50vh)] overflow-auto p-4 text-sm text-black [&_img]:h-auto [&_img]:max-w-full"
                // Preview-only HTML we just built from the editor + sample merge fields.
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
          <DialogFooter className="p-8 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              disabled={sendingPreview}
            >
              Close
            </Button>
            <LoadingButton
              type="button"
              loading={sendingPreview}
              loadingLabel="Sending…"
              onClick={sendPreviewEmail}
            >
              <SendIcon data-icon="inline-start" />
              Send
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
