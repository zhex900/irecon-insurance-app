import { CodeIcon, PencilIcon } from "lucide-react";
import { type FormEvent,useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";

import { EmailDocumentFrame } from "~/components/email/email-document-frame";
import { EmailHtmlCodeEditor } from "~/components/email/email-html-code-editor";
import { EmailTemplateEditorActions } from "~/components/email/email-template-editor-actions";
import { EmailTemplatePlaceholders } from "~/components/email/email-template-placeholders";
import { EmailTemplatePreviewDialog } from "~/components/email/email-template-preview-dialog";
import { PageHeader } from "~/components/layout/app-layout";
import { Button } from "~/components/ui/button";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { useEmailTemplateHistory } from "~/hooks/use-email-template-history";
import type { EmailTemplateEditorLoaderData } from "~/lib/email/template-editor-types";
import {
  applyEmailTemplate,
  buildOutboundTemplateHtml,
  emailTemplatePreviewVars,
  extractEmailFooterImage,
  htmlToPlainText,
  injectEmailFooterImage,
  unwrapEmailPlaceholderTags,
  wrapEmailPlaceholderTags,
} from "~/lib/email/templates";

export function EmailTemplateEditor({
  loaderData,
}: {
  loaderData: EmailTemplateEditorLoaderData;
}) {
  const {
    template,
    meta,
    canEdit,
    viewerEmail,
    footerImageDataUri,
    footerImageWidth,
  } = loaderData;
  const fetcher = useFetcher();
  const handledDataRef = useRef<typeof fetcher.data>(undefined);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const subjectSelectionRef = useRef<{ start: number; end: number } | null>(
    null,
  );

  const [subject, setSubject] = useState(template.subject);
  const [codeHtml, setCodeHtml] = useState(() =>
    injectEmailFooterImage(template.body, footerImageDataUri, footerImageWidth),
  );
  const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");
  const [frameKey, setFrameKey] = useState(0);
  const [toEmail, setToEmail] = useState(template.toEmail);
  const [insertTarget, setInsertTarget] = useState<"subject" | "body">("body");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewTo, setPreviewTo] = useState(viewerEmail);

  const {
    canUndoHistory,
    canRedoHistory,
    pushHistory,
    scheduleHistoryPush,
    resetHistory,
    handleUndo,
    handleRedo,
  } = useEmailTemplateHistory({
    canEdit,
    subject,
    codeHtml,
    setSubject,
    setCodeHtml,
    setFrameKey,
  });
  const busy = fetcher.state !== "idle";
  const sendingPreview =
    busy && String(fetcher.formData?.get("intent") ?? "") === "send-preview";
  const resetting =
    busy && String(fetcher.formData?.get("intent") ?? "") === "reset";
  const showToEmail = template.recipientType === "insurer";

  const sampleVars = useMemo(
    () => emailTemplatePreviewVars({ footerImageDataUri }),
    [footerImageDataUri],
  );

  /** Visual: keep {{placeholders}} as yellow tags. */
  const viewHtml = useMemo(
    () =>
      wrapEmailPlaceholderTags(
        buildOutboundTemplateHtml(codeHtml, {
          footerImageWidth,
          footerImageDataUri,
        }),
      ),
    [codeHtml, footerImageWidth, footerImageDataUri],
  );

  /** Preview / send: merge fields filled with sample data. */
  const previewFilledHtml = useMemo(
    () =>
      buildOutboundTemplateHtml(applyEmailTemplate(codeHtml, sampleVars), {
        footerImageWidth,
        footerImageDataUri,
      }),
    [codeHtml, sampleVars, footerImageWidth, footerImageDataUri],
  );

  function handleVisualHtmlChange(nextHtml: string) {
    if (!canEdit) return;
    const next = unwrapEmailPlaceholderTags(nextHtml);
    setCodeHtml(next);
    scheduleHistoryPush();
  }

  function insertPlaceholder(token: string, key: string) {
    if (!canEdit) return;
    pushHistory();
    const content =
      key === "footerImage" && footerImageDataUri
        ? `<img src="${footerImageDataUri}" alt="Irecon Advisernet Logo" width="${footerImageWidth}" style="display:block;width:${footerImageWidth}px;max-width:100%;height:auto">`
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
    setCodeHtml((prev) => `${prev}${content}`);
    setFrameKey((k) => k + 1);
    scheduleHistoryPush();
  }

  function openPreview() {
    setPreviewSubject(applyEmailTemplate(subject, sampleVars));
    setPreviewHtml(previewFilledHtml);
    setPreviewText(htmlToPlainText(previewFilledHtml));
    setPreviewTo(viewerEmail);
    setPreviewOpen(true);
  }

  function sendPreviewEmail() {
    const formData = new FormData();
    formData.set("intent", "send-preview");
    formData.set("to", previewTo);
    formData.set("subject", previewSubject);
    formData.set("html", previewHtml);
    formData.set("text", previewText);
    fetcher.submit(formData, { method: "post" });
  }

  function handleReset() {
    if (!canEdit) return;
    const formData = new FormData();
    formData.set("intent", "reset");
    fetcher.submit(formData, { method: "post" });
  }

  const syncedLoaderRef = useRef<string | null>(null);

  useEffect(() => {
    const injected = injectEmailFooterImage(
      template.body,
      footerImageDataUri,
      footerImageWidth,
    );
    const loaderSignature = [
      template.recipientType,
      template.subject,
      template.body,
      template.toEmail,
      footerImageDataUri,
      footerImageWidth,
    ].join("\0");

    const isFirstLoad = syncedLoaderRef.current === null;
    if (syncedLoaderRef.current === loaderSignature) return;
    syncedLoaderRef.current = loaderSignature;

    resetHistory({ subject: template.subject, body: injected });

    // Initial useState already matches loader data — skip redundant setState and
    // frameKey bump that reload the visual editor on cold open.
    if (isFirstLoad) return;

    setSubject(template.subject);
    setCodeHtml(injected);
    setToEmail(template.toEmail);
    setFrameKey((key) => key + 1);
  }, [
    template.recipientType,
    template.subject,
    template.body,
    template.toEmail,
    footerImageDataUri,
    footerImageWidth,
    resetHistory,
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
      const injected = injectEmailFooterImage(
        saved.body,
        footerImageDataUri,
        footerImageWidth,
      );
      setSubject(saved.subject);
      setCodeHtml(injected);
      setToEmail(saved.toEmail);
      setFrameKey((key) => key + 1);
      resetHistory({ subject: saved.subject, body: injected });
      if (data.reset) {
        toast.success(
          meta.sourceAscx
            ? `Loaded ${meta.sourceAscx}`
            : "Reset to default template",
        );
        return;
      }
      toast.success(`${meta.title} saved`);
    } else if ("error" in data) {
      toast.error(data.error);
    }
  }, [
    fetcher.state,
    fetcher.data,
    meta.title,
    meta.sourceAscx,
    footerImageDataUri,
    footerImageWidth,
    resetHistory,
  ]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const body = extractEmailFooterImage(
      codeHtml.trim(),
      footerImageDataUri,
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
              <EmailTemplateEditorActions
                canEdit={canEdit}
                busy={busy}
                resetting={resetting}
                saving={busy && !sendingPreview && !resetting}
                canUndo={canUndoHistory}
                canRedo={canRedoHistory}
                resetTitle={
                  meta.sourceAscx
                    ? `Reload from ${meta.sourceAscx}`
                    : "Reset to default"
                }
                onUndo={handleUndo}
                onRedo={handleRedo}
                onPreview={openPreview}
                onReset={handleReset}
              />
            </div>
            <div className="hidden lg:block" aria-hidden />

            <div
              className="flex flex-col gap-2"
              onFocusCapture={() => setInsertTarget("body")}
              onMouseDown={() => setInsertTarget("body")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={editorMode === "visual" ? "secondary" : "outline"}
                    onClick={() => {
                      setFrameKey((k) => k + 1);
                      setEditorMode("visual");
                    }}
                  >
                    <PencilIcon data-icon="inline-start" />
                    Visual
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={editorMode === "code" ? "secondary" : "outline"}
                    onClick={() => setEditorMode("code")}
                  >
                    <CodeIcon data-icon="inline-start" />
                    Code
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {editorMode === "code"
                    ? "Edit ASCX HTML. Visual shows {{placeholders}}; Preview fills sample data."
                    : "{{placeholders}} as tags here. Preview shows sample merge values."}
                </p>
              </div>
              {editorMode === "code" ? (
                <EmailHtmlCodeEditor
                  value={codeHtml}
                  readOnly={!canEdit}
                  onChange={(next) => {
                    if (!canEdit) return;
                    setCodeHtml(next);
                    scheduleHistoryPush();
                  }}
                  aria-label="Email HTML source"
                />
              ) : (
                <div className="overflow-hidden rounded-lg border bg-white">
                  <EmailDocumentFrame
                    title="Email Visual"
                    html={viewHtml}
                    editable={canEdit}
                    reloadKey={frameKey}
                    onHtmlChange={handleVisualHtmlChange}
                    className="h-[min(36rem,65vh)]"
                  />
                </div>
              )}
            </div>

            <EmailTemplatePlaceholders
              editable={canEdit}
              target={insertTarget}
              onInsert={insertPlaceholder}
            />
          </div>
        </Field>
      </form>

      <EmailTemplatePreviewDialog
        open={previewOpen}
        recipient={previewTo}
        subject={previewSubject}
        html={previewHtml}
        sending={sendingPreview}
        onOpenChange={setPreviewOpen}
        onRecipientChange={setPreviewTo}
        onSend={sendPreviewEmail}
      />
    </div>
  );
}
