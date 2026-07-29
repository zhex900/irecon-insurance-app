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
import { applyFlowPushDown } from "~/lib/pdf/flow-push-down";
import { invalidatePdfTemplateOverrideCache } from "~/lib/pdf/generate";
import { pdfmePlugins } from "~/lib/pdf/plugins";
import { buildSampleMergeInputs } from "~/lib/pdf/sample-merge-inputs";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  getEditableDocumentTemplateSlot,
  publishDocumentTemplate,
  resetDocumentTemplate,
  saveDocumentTemplateDraft,
  undoDocumentTemplatePublish,
} from "~/lib/services/documents/document-templates";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import type { Route } from "./+types/document-templates.$slotKey";

export function meta() {
  return [{ title: pageTitle("Document template") }];
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

  if (intent === "reset") {
    try {
      await resetDocumentTemplate(slotKey);
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_reset",
        entityType: "document_template",
        entityId: slotKey,
        summary: `Reset document template ${slotKey} to seed`,
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
            : "Failed to reset document template.",
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
        summary: result.usedSeed
          ? `Undid publish for ${slotKey} (back to seed)`
          : `Undid publish for ${slotKey} → v${result.published?.versionNumber}`,
        metadata: {
          slotKey,
          publishedVersionNumber: result.published?.versionNumber ?? null,
          usedSeed: result.usedSeed,
        },
        request,
      });
      return {
        ok: true as const,
        intent: "undo" as const,
        slotKey,
        versionNumber: result.published?.versionNumber ?? null,
        usedSeed: result.usedSeed,
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
    slotKey,
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
      toast.success("Template reset to seed");
      void navigate("/settings/document-templates");
      return;
    }
    if (data.intent === "publish") {
      toast.success(`Published v${data.versionNumber}`);
      revalidator.revalidate();
      return;
    }
    if (data.intent === "undo") {
      toast.success(
        data.usedSeed
          ? "Undid publish — seed is live again"
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
        "Undo the current published version? The previous published version (or seed) will become live.",
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
        "Delete all versions for this template and use the seed asset? This cannot be undone.",
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
        title={slot.title}
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
          { label: "Document templates", to: "/settings/document-templates" },
          { label: slot.title },
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
                  Reset to seed
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
        key={`${slot.key}-${loaderData.editingVersionNumber ?? "seed"}-${loaderData.publishedVersionNumber ?? "none"}`}
        ref={designerRef}
        template={slot.template as Template}
        editable={canEdit}
        className="min-h-[70vh] flex-1 overflow-hidden rounded-xl border bg-background"
      />

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
        title={`${slot.title} — preview`}
        description="Generated with sample policy data (not a real policy)."
        src={previewSrc}
        loading={previewLoading}
        error={previewError}
      />
    </div>
  );
}
