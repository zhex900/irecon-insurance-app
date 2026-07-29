import { useEffect, useRef, useState } from "react";
import {
  redirect,
  useFetcher,
  useNavigate,
  useRevalidator,
} from "react-router";
import { generate } from "@pdfme/generator";
import type { Template } from "@pdfme/common";
import { toast } from "sonner";
import { PageHeader } from "~/components/layout/app-layout";
import { PdfPreviewDialog } from "~/components/pdf-preview-dialog";
import {
  PdfmeDesigner,
  type PdfmeDesignerHandle,
} from "~/components/settings/pdfme-designer";
import { DocumentTemplatesEditorShell } from "~/components/settings/document-templates-loading";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import { requireAuth } from "~/lib/auth/session.server";
import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import { pageTitle } from "~/lib/brand";
import {
  collectMergeFields,
  documentTemplateStatusLabel,
  parseTemplateForm,
} from "~/lib/documents/template-editor-form";
import { formatDocumentTemplateTitle } from "~/lib/documents/template-title";
import { applyFlowPushDown } from "~/lib/pdf/flow-push-down";
import { invalidatePdfTemplateOverrideCache } from "~/lib/pdf/generate";
import { pdfmePlugins } from "~/lib/pdf/plugins";
import { buildSampleMergeInputs } from "~/lib/pdf/sample-merge-inputs";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  deleteDocumentTemplate,
  getEditableDocumentTemplateSlot,
  publishDocumentTemplate,
  saveDocumentTemplateDraft,
  undoDocumentTemplatePublish,
  updateDocumentTemplateMeta,
} from "~/lib/services/documents/document-templates";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import type { Route } from "./+types/document-templates.$slotKey";

export function meta() {
  return [{ title: pageTitle("Document Template") }];
}

/** Title immediately; skeleton only for the designer pane. */
export function HydrateFallback() {
  return <DocumentTemplatesEditorShell title="Document Template" />;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const enabled = await isFeatureEnabled("document_templates");
  if (!enabled && !isSuperAdmin(viewer)) {
    throw redirect("/settings");
  }

  const slotKey = String(params.slotKey ?? "");
  const state = await getEditableDocumentTemplateSlot(slotKey);
  if (!state) {
    throw redirect("/settings/document-templates");
  }

  const { slot } = state;
  return {
    canEdit: isAdminRole(viewer),
    documentTemplatesEnabled: enabled,
    editingVersionNumber: state.editingVersionNumber,
    editingIsPublished: state.editingIsPublished,
    publishedVersionNumber: state.publishedVersionNumber,
    canUndo: state.canUndo,
    versions: state.versions,
    slot: {
      key: slot.key,
      title: slot.title,
      coverTypeId: slot.coverTypeId,
      versionNumber: slot.versionNumber,
      flowPushDown: slot.flowPushDown ?? null,
      mergeFields: slot.mergeFields,
      template: {
        basePdf: slot.template.basePdf,
        schemas: slot.template.schemas as Record<string, unknown>[][],
        pdfmeVersion: slot.template.pdfmeVersion,
      },
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const viewer = await requireAuth(request);
  if (!isAdminRole(viewer)) {
    return {
      ok: false as const,
      error: "Only admins can change document templates.",
    };
  }

  const enabled = await isFeatureEnabled("document_templates");
  if (!enabled && !isSuperAdmin(viewer)) {
    return { ok: false as const, error: "Document templates is disabled." };
  }

  const slotKey = String(params.slotKey ?? "");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "draft");

  if (intent === "meta") {
    try {
      const coverRaw = String(formData.get("coverTypeId") ?? "");
      const coverTypeId =
        coverRaw === "all" || coverRaw === ""
          ? null
          : (Number(coverRaw) as 1 | 2 | 3);
      await updateDocumentTemplateMeta({
        documentTemplateKey: slotKey,
        coverTypeId,
        title: String(formData.get("title") ?? ""),
      });
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_meta",
        entityType: "document_template",
        entityId: slotKey,
        summary: `Updated metadata for document template ${slotKey}`,
        metadata: { slotKey, coverTypeId },
        request,
      });
      return { ok: true as const, intent: "meta" as const, slotKey };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update document template metadata.",
      };
    }
  }

  if (intent === "reset") {
    try {
      await deleteDocumentTemplate(slotKey);
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_reset",
        entityType: "document_template",
        entityId: slotKey,
        summary: `Deleted document template ${slotKey}`,
        metadata: { slotKey },
        request,
      });
      return { ok: true as const, intent: "reset" as const, slotKey };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete document template.",
      };
    }
  }

  if (intent === "undo") {
    try {
      const result = await undoDocumentTemplatePublish(slotKey, viewer.email);
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_undo",
        entityType: "document_template",
        entityId: slotKey,
        summary: result.unpublished
          ? `Undid publish for ${slotKey} (nothing published)`
          : `Undid publish for ${slotKey} → v${result.published?.versionNumber}`,
        metadata: {
          slotKey,
          publishedVersionNumber: result.published?.versionNumber ?? null,
          unpublished: result.unpublished,
        },
        request,
      });
      return {
        ok: true as const,
        intent: "undo" as const,
        slotKey,
        versionNumber: result.published?.versionNumber ?? null,
        unpublished: result.unpublished,
      };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error
            ? error.message
            : "Failed to undo document template publish.",
      };
    }
  }

  const parsed = parseTemplateForm(formData);
  if (!parsed.ok) {
    return { ok: false as const, error: parsed.error };
  }

  const payload = {
    documentTemplateKey: slotKey,
    template: parsed.template,
    flowPushDown: parsed.flowPushDown,
    mergeFields: parsed.mergeFields,
  };

  if (intent === "publish") {
    try {
      const saved = await publishDocumentTemplate(payload, viewer.email);
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_publish",
        entityType: "document_template",
        entityId: slotKey,
        summary: `Published document template ${slotKey} (v${saved.versionNumber})`,
        metadata: { slotKey, versionNumber: saved.versionNumber },
        request,
      });
      return {
        ok: true as const,
        intent: "publish" as const,
        slotKey,
        versionNumber: saved.versionNumber,
      };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish document template.",
      };
    }
  }

  try {
    const saved = await saveDocumentTemplateDraft(payload, viewer.email);
    await writeAuditLog({
      actor: viewer,
      action: "settings.document_template_draft",
      entityType: "document_template",
      entityId: slotKey,
      summary: `Saved draft document template ${slotKey} (v${saved.versionNumber})`,
      metadata: { slotKey, versionNumber: saved.versionNumber },
      request,
    });
    return {
      ok: true as const,
      intent: "draft" as const,
      slotKey,
      versionNumber: saved.versionNumber,
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save document template draft.",
    };
  }
}

export default function DocumentTemplateEditorRoute({
  loaderData,
}: Route.ComponentProps) {
  const { slot, canEdit } = loaderData;
  const displayTitle = formatDocumentTemplateTitle(slot.title);
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<typeof action>();
  const designerRef = useRef<PdfmeDesignerHandle>(null);
  const handledDataRef = useRef<typeof fetcher.data>(undefined);
  const previewUrlRef = useRef<string | null>(null);
  const busy = fetcher.state !== "idle";

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (handledDataRef.current === fetcher.data) return;
    handledDataRef.current = fetcher.data;
    const data = fetcher.data;

    if (!data.ok) {
      toast.error(data.error);
      return;
    }

    invalidatePdfTemplateOverrideCache(data.slotKey);

    if (data.intent === "reset") {
      toast.success("Template deleted");
      void navigate("/settings/document-templates");
      return;
    }
    if (data.intent === "meta") {
      toast.success("Template details saved");
      revalidator.revalidate();
      return;
    }
    if (data.intent === "publish") {
      toast.success(`Published v${data.versionNumber}`);
      revalidator.revalidate();
      return;
    }
    if (data.intent === "undo") {
      toast.success(
        data.unpublished
          ? "Undid publish — nothing is published for this template"
          : `Undid publish — live is now v${data.versionNumber}`,
      );
      revalidator.revalidate();
      return;
    }
    toast.success(`Draft saved (v${data.versionNumber})`);
    revalidator.revalidate();
  }, [fetcher.state, fetcher.data, navigate, revalidator]);

  function submitTemplate(intent: "draft" | "publish") {
    if (!canEdit) return;
    const template = designerRef.current?.getTemplate();
    if (!template) {
      toast.error("Designer is not ready yet.");
      return;
    }
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("template", JSON.stringify(template));
    formData.set("flowPushDown", JSON.stringify(slot.flowPushDown));
    formData.set(
      "mergeFields",
      JSON.stringify(collectMergeFields(template, slot.mergeFields)),
    );
    fetcher.submit(formData, { method: "post" });
  }

  function handleUndo() {
    if (!canEdit || !loaderData.canUndo) return;
    if (
      !window.confirm(
        "Undo the current published version? The previous published version will become live, or nothing if none remains.",
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("intent", "undo");
    fetcher.submit(formData, { method: "post" });
  }

  function handleReset() {
    if (!canEdit) return;
    if (
      !window.confirm(
        "Delete all versions for this template? PDF generation for this key will fail until you create/publish again. This cannot be undone.",
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("intent", "reset");
    fetcher.submit(formData, { method: "post" });
  }

  async function handlePreview() {
    const template = designerRef.current?.getTemplate();
    if (!template) {
      toast.error("Designer is not ready yet.");
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewSrc(null);

    try {
      const mergeFields = collectMergeFields(template, slot.mergeFields);
      const inputs = buildSampleMergeInputs(
        template,
        mergeFields,
        slot.flowPushDown,
      );
      const prepared = applyFlowPushDown(template, slot.flowPushDown, inputs);
      const pdf = await generate({
        template: prepared,
        inputs: [inputs],
        plugins: pdfmePlugins,
      });
      const blob = new Blob([pdf.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewSrc(url);
      setPreviewLoading(false);
    } catch (error) {
      setPreviewLoading(false);
      setPreviewError(
        error instanceof Error ? error.message : "Failed to generate preview",
      );
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <PageHeader
        title={displayTitle}
        description={
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              {documentTemplateStatusLabel(loaderData)}
            </p>
            <p>
              Save draft to keep history. Publish to make it live for PDF
              generation. Undo restores the previous published version.
            </p>
          </div>
        }
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Document Templates", to: "/settings/document-templates" },
          { label: displayTitle },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || previewLoading}
              onClick={() => void navigate("/settings/document-templates")}
            >
              Back
            </Button>
            <LoadingButton
              type="button"
              variant="outline"
              loading={previewLoading}
              loadingLabel="Preview…"
              disabled={busy}
              onClick={() => void handlePreview()}
            >
              Preview
            </LoadingButton>
            {canEdit ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || previewLoading || !loaderData.canUndo}
                  onClick={handleUndo}
                >
                  Undo publish
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || previewLoading}
                  onClick={handleReset}
                >
                  Delete template
                </Button>
                <LoadingButton
                  type="button"
                  variant="outline"
                  loading={
                    busy && String(fetcher.formData?.get("intent")) === "draft"
                  }
                  loadingLabel="Saving…"
                  disabled={previewLoading || busy}
                  onClick={() => submitTemplate("draft")}
                >
                  Save draft
                </LoadingButton>
                <LoadingButton
                  type="button"
                  loading={
                    busy &&
                    String(fetcher.formData?.get("intent")) === "publish"
                  }
                  loadingLabel="Publishing…"
                  disabled={previewLoading || busy}
                  onClick={() => submitTemplate("publish")}
                >
                  Publish
                </LoadingButton>
              </>
            ) : null}
          </div>
        }
      />

      <PdfmeDesigner
        key={`${slot.key}-${loaderData.editingVersionNumber ?? "draft"}-${loaderData.publishedVersionNumber ?? "none"}`}
        ref={designerRef}
        template={slot.template as Template}
        editable={canEdit}
        className="min-h-[70vh] flex-1 overflow-hidden rounded-xl border bg-background"
      />

      {canEdit ? (
        <fetcher.Form
          method="post"
          className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3"
        >
          <input type="hidden" name="intent" value="meta" />
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              name="title"
              defaultValue={slot.title}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="coverTypeId">
              Cover type
            </label>
            <select
              id="coverTypeId"
              name="coverTypeId"
              defaultValue={
                slot.coverTypeId == null ? "all" : String(slot.coverTypeId)
              }
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              <option value="1">Annual</option>
              <option value="2">Single</option>
              <option value="3">Owner Builder</option>
              <option value="all">All cover types</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" variant="outline" disabled={busy}>
              Save details
            </Button>
          </div>
        </fetcher.Form>
      ) : null}

      <PdfPreviewDialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            if (previewUrlRef.current) {
              URL.revokeObjectURL(previewUrlRef.current);
              previewUrlRef.current = null;
            }
            setPreviewSrc(null);
            setPreviewError(null);
            setPreviewLoading(false);
          }
        }}
        title={`${displayTitle} — preview`}
        description="Generated with sample policy data (not a real policy)."
        src={previewSrc}
        loading={previewLoading}
        error={previewError}
      />
    </div>
  );
}
