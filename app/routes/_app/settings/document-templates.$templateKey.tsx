import { useEffect, useRef, useState } from "react";
import {
  redirect,
  useBlocker,
  useFetcher,
  useNavigate,
  useRevalidator,
} from "react-router";
import type { Template } from "@pdfme/common";
import {
  ArrowLeftIcon,
  CheckIcon,
  EyeIcon,
  FilePlusIcon,
  HistoryIcon,
  PencilIcon,
  RectangleHorizontalIcon,
  RectangleVerticalIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
  Undo2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "~/components/layout/app-layout";
import { PdfPreviewDialog } from "~/components/pdf-preview-dialog";
import { DocumentTemplateDeleteDialog } from "~/components/settings/document-template-delete-dialog";
import { DocumentTemplateHistorySheet } from "~/components/settings/document-template-history-sheet";
import { DocumentTemplateLeaveDialog } from "~/components/settings/document-template-leave-dialog";
import {
  PdfmeDesigner,
  type PdfmeDesignerHandle,
} from "~/components/settings/pdfme-designer";
import { DocumentTemplatesEditorShell } from "~/components/settings/document-templates-loading";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { requireAuth } from "~/lib/auth/session.server";
import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import { pageTitle } from "~/lib/brand";
import {
  collectMergeFields,
  parseTemplateForm,
} from "~/lib/documents/template-editor-form";
import { DOCUMENT_LABEL_MAX_LENGTH } from "~/lib/documents/document-label";
import { formatDocumentTemplateTitle } from "~/lib/documents/template-title";
import { applyFlowPushDown } from "~/lib/pdf/flow-push-down";
import { normalizePdfmeTemplateSchemas } from "~/lib/pdf/merge-fields";
import { buildSampleMergeInputs } from "~/lib/pdf/sample-merge-inputs";
import { invalidatePdfTemplateOverrideCache } from "~/lib/pdf/template-override-cache";
import {
  getTemplateOrientation,
  type DocumentPageOrientation,
} from "~/lib/pdf/templates";
import {
  diffUnsavedTemplate,
  type TemplateChange,
} from "~/lib/pdf/template-changelog";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  getDocumentTemplateHistory,
  type DocumentTemplateHistoryEntry,
} from "~/lib/services/documents/document-template-history";
import {
  autosaveDocumentTemplateDraft,
  deleteDocumentTemplate,
  getEditableDocumentTemplate,
  publishDocumentTemplate,
  publishDocumentTemplateVersion,
  saveDocumentTemplateDraft,
  undoDocumentTemplatePublish,
  updateDocumentTemplateMeta,
} from "~/lib/services/documents/document-templates";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import type { Route } from "./+types/document-templates.$templateKey";

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

  const templateKey = String(params.templateKey ?? "");
  const [state, history] = await Promise.all([
    getEditableDocumentTemplate(templateKey),
    getDocumentTemplateHistory(templateKey),
  ]);
  if (!state) {
    throw redirect("/settings/document-templates");
  }

  const { template: editable } = state;
  return {
    canEdit: isAdminRole(viewer),
    canDelete: isSuperAdmin(viewer),
    documentTemplatesEnabled: enabled,
    editingVersionNumber: state.editingVersionNumber,
    editingIsPublished: state.editingIsPublished,
    publishedVersionNumber: state.publishedVersionNumber,
    canUndo: state.canUndo,
    viewerName: viewer.fullName?.trim() || viewer.email,
    history,
    template: {
      key: editable.key,
      title: editable.title,
      label: editable.label,
      coverTypeId: editable.coverTypeId,
      versionNumber: editable.versionNumber,
      flowPushDown: editable.flowPushDown ?? null,
      mergeFields: editable.mergeFields,
      template: {
        basePdf: editable.template.basePdf,
        schemas: editable.template.schemas as Record<string, unknown>[][],
        pdfmeVersion: editable.template.pdfmeVersion,
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

  const templateKey = String(params.templateKey ?? "");
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
        documentTemplateKey: templateKey,
        coverTypeId,
        title: String(formData.get("title") ?? ""),
        label: String(formData.get("label") ?? ""),
      });
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_meta",
        entityType: "document_template",
        entityId: templateKey,
        summary: `Updated metadata for document template ${templateKey}`,
        metadata: {
          templateKey,
          coverTypeId,
          label: String(formData.get("label") ?? ""),
        },
        request,
      });
      return { ok: true as const, intent: "meta" as const, templateKey };
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
    if (!isSuperAdmin(viewer)) {
      return {
        ok: false as const,
        error: "Only super-admins can delete document templates.",
      };
    }
    try {
      await deleteDocumentTemplate(templateKey);
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_reset",
        entityType: "document_template",
        entityId: templateKey,
        summary: `Deleted document template ${templateKey}`,
        metadata: { templateKey },
        request,
      });
      return { ok: true as const, intent: "reset" as const, templateKey };
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

  if (intent === "publish-version") {
    try {
      const versionNumber = Number(formData.get("versionNumber"));
      if (!Number.isInteger(versionNumber) || versionNumber < 1) {
        return { ok: false as const, error: "Invalid version number." };
      }
      const saved = await publishDocumentTemplateVersion(
        templateKey,
        versionNumber,
        viewer.email,
      );
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_publish",
        entityType: "document_template",
        entityId: templateKey,
        summary: `Set document template ${templateKey} live to v${saved.versionNumber}`,
        metadata: { templateKey, versionNumber: saved.versionNumber },
        request,
      });
      return {
        ok: true as const,
        intent: "publish-version" as const,
        templateKey,
        versionNumber: saved.versionNumber,
      };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish document template version.",
      };
    }
  }

  if (intent === "undo") {
    try {
      const result = await undoDocumentTemplatePublish(
        templateKey,
        viewer.email,
      );
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_undo",
        entityType: "document_template",
        entityId: templateKey,
        summary: result.unpublished
          ? `Undid publish for ${templateKey} (nothing published)`
          : `Undid publish for ${templateKey} → v${result.published?.versionNumber}`,
        metadata: {
          templateKey,
          publishedVersionNumber: result.published?.versionNumber ?? null,
          unpublished: result.unpublished,
        },
        request,
      });
      return {
        ok: true as const,
        intent: "undo" as const,
        templateKey,
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
    documentTemplateKey: templateKey,
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
        entityId: templateKey,
        summary: `Published document template ${templateKey} (v${saved.versionNumber})`,
        metadata: { templateKey, versionNumber: saved.versionNumber },
        request,
      });
      return {
        ok: true as const,
        intent: "publish" as const,
        templateKey,
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

  const isAutosave = intent === "autosave";

  try {
    const saved = isAutosave
      ? await autosaveDocumentTemplateDraft(payload, viewer.email)
      : await saveDocumentTemplateDraft(payload, viewer.email);

    if (!isAutosave) {
      await writeAuditLog({
        actor: viewer,
        action: "settings.document_template_draft",
        entityType: "document_template",
        entityId: templateKey,
        summary: `Saved draft document template ${templateKey} (v${saved.versionNumber})`,
        metadata: { templateKey, versionNumber: saved.versionNumber },
        request,
      });
    }

    return {
      ok: true as const,
      intent: isAutosave ? ("autosave" as const) : ("draft" as const),
      templateKey,
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
  const { template: docTemplate, canEdit, canDelete } = loaderData;
  const displayTitle = formatDocumentTemplateTitle(docTemplate.title);
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<typeof action>();
  const designerRef = useRef<PdfmeDesignerHandle>(null);
  const handledDataRef = useRef<typeof fetcher.data>(undefined);
  const previewUrlRef = useRef<string | null>(null);
  const baselineTemplateRef = useRef<Template | null>(null);
  /** Checkpoint for Revert — set on open and on manual Save draft / Publish. */
  const revertTemplateRef = useRef<Template | null>(null);
  const allowLeaveRef = useRef(false);
  const submittedTemplateRef = useRef<Template | null>(null);
  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAutosaveRef = useRef(false);
  const fetcherStateRef = useRef(fetcher.state);
  const scheduleAutosaveRef = useRef<() => void>(() => {});
  const busy = fetcher.state !== "idle";
  fetcherStateRef.current = fetcher.state;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<DocumentPageOrientation>(() =>
    getTemplateOrientation(docTemplate.template as Template),
  );
  const [previewTitle, setPreviewTitle] = useState(displayTitle);
  const [titleValue, setTitleValue] = useState(docTemplate.title);
  const [labelValue, setLabelValue] = useState(docTemplate.label);
  const [coverTypeValue, setCoverTypeValue] = useState(
    docTemplate.coverTypeId == null ? "all" : String(docTemplate.coverTypeId),
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [prevTemplateKey, setPrevTemplateKey] = useState(docTemplate.key);
  const [dirty, setDirty] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState<TemplateChange[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [manualLeaveOpen, setManualLeaveOpen] = useState(false);
  const [pendingLeaveAfterSave, setPendingLeaveAfterSave] = useState(false);
  const [canRevert, setCanRevert] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<
    "idle" | "pending" | "saving" | "saved"
  >("idle");

  dirtyRef.current = dirty;

  // Reset local meta when navigating between templates.
  if (docTemplate.key !== prevTemplateKey) {
    setPrevTemplateKey(docTemplate.key);
    setTitleValue(docTemplate.title);
    setLabelValue(docTemplate.label);
    setCoverTypeValue(
      docTemplate.coverTypeId == null ? "all" : String(docTemplate.coverTypeId),
    );
    setEditingTitle(false);
    setDirty(false);
    setUnsavedChanges([]);
    setCanRevert(false);
    setAutosaveStatus("idle");
  }

  useEffect(() => {
    baselineTemplateRef.current = null;
    revertTemplateRef.current = null;
  }, [docTemplate.key]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (autosaveStatus !== "saved") return;
    const timer = setTimeout(() => {
      setAutosaveStatus((prev) => (prev === "saved" ? "idle" : prev));
    }, 2500);
    return () => clearTimeout(timer);
  }, [autosaveStatus]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowLeaveRef.current) return false;
    if (currentLocation.pathname === nextLocation.pathname) return false;
    return dirty;
  });

  const leaveOpen = manualLeaveOpen || blocker.state === "blocked";

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
      queueMicrotask(() => {
        setPendingLeaveAfterSave(false);
        setAutosaveStatus(dirtyRef.current ? "pending" : "idle");
      });
      toast.error(data.error);
      if (pendingAutosaveRef.current || dirtyRef.current) {
        pendingAutosaveRef.current = false;
        scheduleAutosaveRef.current();
      }
      return;
    }

    invalidatePdfTemplateOverrideCache(data.templateKey);

    if (data.intent === "reset") {
      toast.success("Template deleted");
      allowLeaveRef.current = true;
      void navigate("/settings/document-templates");
      return;
    }
    if (data.intent === "meta") {
      toast.success("Saved");
      revalidator.revalidate();
      return;
    }
    if (data.intent === "publish" || data.intent === "publish-version") {
      toast.success(`Published v${data.versionNumber}`);
      const saved = submittedTemplateRef.current;
      if (saved) {
        baselineTemplateRef.current = saved;
        revertTemplateRef.current = saved;
      } else {
        const current = designerRef.current?.getTemplate();
        if (current) {
          baselineTemplateRef.current = current;
          revertTemplateRef.current = current;
        }
      }
      queueMicrotask(() => {
        syncDirtyFromBaseline();
        syncCanRevert();
        setAutosaveStatus("idle");
      });
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

    const saved = submittedTemplateRef.current;
    if (saved) baselineTemplateRef.current = saved;

    const isAutosave = data.intent === "autosave";
    if (!isAutosave && saved) {
      revertTemplateRef.current = saved;
      toast.success(`Draft saved (v${data.versionNumber})`);
    }

    queueMicrotask(() => {
      syncDirtyFromBaseline();
      syncCanRevert();
      setAutosaveStatus(isAutosave ? "saved" : "idle");
      if (pendingLeaveAfterSave && !isAutosave) {
        setPendingLeaveAfterSave(false);
        allowLeaveRef.current = true;
        setManualLeaveOpen(false);
        if (blocker.state === "blocked") blocker.proceed?.();
        else void navigate("/settings/document-templates");
        return;
      }
      if (pendingAutosaveRef.current || dirtyRef.current) {
        pendingAutosaveRef.current = false;
        scheduleAutosaveRef.current();
      }
    });
    revalidator.revalidate();
  }, [
    fetcher.state,
    fetcher.data,
    navigate,
    revalidator,
    blocker,
    pendingLeaveAfterSave,
  ]);

  function syncDirtyFromBaseline() {
    const baseline = baselineTemplateRef.current;
    const current = designerRef.current?.getTemplate();
    if (!baseline || !current) {
      setDirty(false);
      setUnsavedChanges([]);
      dirtyRef.current = false;
      return;
    }
    const changes = diffUnsavedTemplate(baseline, current);
    setUnsavedChanges(changes);
    setDirty(changes.length > 0);
    dirtyRef.current = changes.length > 0;
  }

  function syncCanRevert(current?: Template | null) {
    const checkpoint = revertTemplateRef.current;
    const live = current ?? designerRef.current?.getTemplate();
    if (!checkpoint || !live) {
      setCanRevert(false);
      return;
    }
    setCanRevert(diffUnsavedTemplate(checkpoint, live).length > 0);
  }

  function clearAutosaveTimer() {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }

  function scheduleAutosave() {
    if (!canEdit) return;
    clearAutosaveTimer();
    setAutosaveStatus((prev) => (prev === "saving" ? prev : "pending"));
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      runAutosave();
    }, 1500);
  }
  scheduleAutosaveRef.current = scheduleAutosave;

  function runAutosave() {
    if (!canEdit || !dirtyRef.current) {
      setAutosaveStatus("idle");
      return;
    }
    if (fetcherStateRef.current !== "idle") {
      pendingAutosaveRef.current = true;
      return;
    }
    submitTemplate("autosave");
  }

  function handleTemplateChange(next: Template) {
    setOrientation(getTemplateOrientation(next));
    if (!baselineTemplateRef.current) {
      baselineTemplateRef.current = next;
      if (!revertTemplateRef.current) revertTemplateRef.current = next;
      setCanRevert(false);
      return;
    }
    const changes = diffUnsavedTemplate(baselineTemplateRef.current, next);
    setUnsavedChanges(changes);
    const nextDirty = changes.length > 0;
    setDirty(nextDirty);
    dirtyRef.current = nextDirty;
    syncCanRevert(next);
    if (nextDirty && canEdit) {
      scheduleAutosave();
    } else {
      clearAutosaveTimer();
      setAutosaveStatus("idle");
    }
  }

  function handleOrientation(next: DocumentPageOrientation) {
    if (!canEdit) return;
    designerRef.current?.setOrientation(next);
    setOrientation(next);
  }

  function handleRevertChanges() {
    if (!canEdit || !canRevert) return;
    const checkpoint = revertTemplateRef.current;
    const designer = designerRef.current;
    if (!checkpoint || !designer) {
      toast.error("Nothing to revert to yet.");
      return;
    }
    if (
      !window.confirm(
        "Revert all layout edits since you opened this template, or since the last Save draft / Publish?",
      )
    ) {
      return;
    }

    clearAutosaveTimer();
    pendingAutosaveRef.current = false;
    // Re-seed baseline + revert checkpoint from the restored designer template.
    baselineTemplateRef.current = null;
    revertTemplateRef.current = null;
    designer.updateTemplate(checkpoint);

    queueMicrotask(() => {
      const current = designer.getTemplate();
      if (current) {
        baselineTemplateRef.current = current;
        revertTemplateRef.current = current;
      }
      setDirty(false);
      setUnsavedChanges([]);
      dirtyRef.current = false;
      setCanRevert(false);
      setAutosaveStatus("idle");
      // Push reverted layout so a prior autosave does not keep discarded edits.
      submitTemplate("autosave");
      toast.success("Changes reverted");
    });
  }

  function submitMeta(next: {
    title?: string;
    label?: string;
    coverTypeId?: string;
  }) {
    if (!canEdit) return;
    const formData = new FormData();
    formData.set("intent", "meta");
    formData.set("title", next.title ?? titleValue);
    formData.set("label", next.label ?? labelValue);
    formData.set("coverTypeId", next.coverTypeId ?? coverTypeValue);
    fetcher.submit(formData, { method: "post" });
  }

  function submitTemplate(intent: "draft" | "publish" | "autosave") {
    if (!canEdit) return;
    const template = designerRef.current?.getTemplate();
    if (!template) {
      if (intent !== "autosave") {
        toast.error("Designer is not ready yet.");
      }
      return;
    }
    if (intent === "draft" || intent === "autosave") {
      clearAutosaveTimer();
      pendingAutosaveRef.current = false;
    }
    submittedTemplateRef.current = template;
    if (intent === "autosave") setAutosaveStatus("saving");
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("template", JSON.stringify(template));
    formData.set("flowPushDown", JSON.stringify(docTemplate.flowPushDown));
    formData.set(
      "mergeFields",
      JSON.stringify(collectMergeFields(template, docTemplate.mergeFields)),
    );
    fetcher.submit(formData, { method: "post" });
  }

  function publishVersion(versionNumber: number) {
    if (!canEdit) return;
    if (
      !window.confirm(
        `Set v${versionNumber} as the published (live) template? PDF generation will use this version.`,
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("intent", "publish-version");
    formData.set("versionNumber", String(versionNumber));
    fetcher.submit(formData, { method: "post" });
  }

  function requestLeaveToList() {
    if (dirty) {
      setManualLeaveOpen(true);
      return;
    }
    allowLeaveRef.current = true;
    void navigate("/settings/document-templates");
  }

  async function generatePreview(template: Template, title: string) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    setPreviewTitle(title);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewSrc(null);

    try {
      const mergeFields = collectMergeFields(template, docTemplate.mergeFields);
      const inputs = buildSampleMergeInputs(
        template,
        mergeFields,
        docTemplate.flowPushDown,
      );
      const prepared = applyFlowPushDown(
        normalizePdfmeTemplateSchemas(
          template as unknown as {
            schemas: Array<Array<Record<string, unknown>>>;
          },
        ) as Template,
        docTemplate.flowPushDown,
        inputs,
      );
      // Keep @pdfme/generator out of the Worker SSR graph — load only on Preview.
      const [{ generate }, { getPdfmeFonts }, { pdfmePlugins }] =
        await Promise.all([
          import("@pdfme/generator"),
          import("~/lib/pdf/fonts"),
          import("~/lib/pdf/plugins"),
        ]);
      const font = await getPdfmeFonts();
      const pdf = await generate({
        template: prepared,
        inputs: [inputs],
        plugins: pdfmePlugins,
        options: { font },
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
    if (!canDelete) return;
    setDeleteOpen(true);
  }

  function confirmDelete() {
    if (!canDelete) return;
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
    await generatePreview(template, displayTitle);
  }

  async function handlePreviewVersion(entry: DocumentTemplateHistoryEntry) {
    try {
      const template = await fetchHistoryVersionTemplate(entry.versionNumber);
      await generatePreview(template, entry.title);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load version",
      );
    }
  }

  async function fetchHistoryVersionTemplate(
    versionNumber: number,
  ): Promise<Template> {
    const response = await fetch(
      `/api/document-templates/${encodeURIComponent(docTemplate.key)}?version=${versionNumber}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to load v${versionNumber}`);
    }
    const data = (await response.json()) as { template: Template };
    return data.template;
  }

  function handleOpenVersionInEditor(entry: DocumentTemplateHistoryEntry) {
    if (!canEdit) return;
    const designer = designerRef.current;
    if (!designer) {
      toast.error("Designer is not ready yet.");
      return;
    }
    if (
      dirty &&
      !window.confirm(
        `Replace unsaved edits with v${entry.versionNumber}? Unsaved changes will be lost.`,
      )
    ) {
      return;
    }

    void (async () => {
      try {
        const template = await fetchHistoryVersionTemplate(entry.versionNumber);
        // Keep last-saved baseline so loading another version marks the editor dirty
        // and autosave can write it as the working draft.
        if (!baselineTemplateRef.current) {
          baselineTemplateRef.current = designer.getTemplate();
        }
        designer.updateTemplate(template);
        setHistoryOpen(false);
        toast.success(`Loaded v${entry.versionNumber} into editor`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load version",
        );
      }
    })();
  }

  const intent = String(fetcher.formData?.get("intent") ?? "");

  return (
    <div className="flex h-[calc(100svh-3.5rem-2rem)] flex-col gap-4 md:h-[calc(100svh-3.5rem-4rem)]">
      <div className="shrink-0 [&>*]:mb-0">
        <PageHeader
          title={
            <EditableTitle
              displayTitle={formatDocumentTemplateTitle(titleValue)}
              value={titleValue}
              canEdit={canEdit}
              busy={busy}
              onChange={setTitleValue}
              onSave={(next) => {
                setTitleValue(next);
                setEditingTitle(false);
                submitMeta({ title: next });
              }}
              onCancel={() => {
                setTitleValue(docTemplate.title);
                setEditingTitle(false);
              }}
              editing={editingTitle}
              onEditingChange={setEditingTitle}
            />
          }
          titleAddon={
            <TemplateVersionBadges
              publishedVersionNumber={loaderData.publishedVersionNumber}
              editingVersionNumber={loaderData.editingVersionNumber}
              editingIsPublished={loaderData.editingIsPublished}
              unsavedCount={dirty ? unsavedChanges.length : 0}
              autosaveStatus={autosaveStatus}
            />
          }
          breadcrumbs={[
            { label: "Settings", to: "/settings" },
            { label: "Document Templates", to: "/settings/document-templates" },
            { label: displayTitle },
          ]}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {canEdit ? (
            <>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Label
                <Input
                  value={labelValue}
                  maxLength={DOCUMENT_LABEL_MAX_LENGTH}
                  aria-label="Document label"
                  disabled={busy || previewLoading}
                  className="h-8 w-44 text-sm"
                  onChange={(event) => setLabelValue(event.target.value)}
                  onBlur={() => {
                    const next = labelValue.trim();
                    if (next === docTemplate.label) return;
                    setLabelValue(next);
                    submitMeta({ label: next });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      (event.target as HTMLInputElement).blur();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setLabelValue(docTemplate.label);
                    }
                  }}
                />
              </label>
              <NativeSelect
                size="sm"
                aria-label="Cover type"
                value={coverTypeValue}
                disabled={busy || previewLoading}
                onChange={(event) => {
                  const next = event.target.value;
                  setCoverTypeValue(next);
                  submitMeta({ coverTypeId: next });
                }}
                className="min-w-36"
              >
                <NativeSelectOption value="1">Annual</NativeSelectOption>
                <NativeSelectOption value="2">Single</NativeSelectOption>
                <NativeSelectOption value="3">Owner Builder</NativeSelectOption>
                <NativeSelectOption value="all">
                  All cover types
                </NativeSelectOption>
              </NativeSelect>
            </>
          ) : (
            <span
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
              title="Document label"
            >
              {labelValue || "—"}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || previewLoading}
            onClick={requestLeaveToList}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Back
          </Button>
          <LoadingButton
            type="button"
            variant="outline"
            size="sm"
            loading={previewLoading}
            loadingLabel="Preview…"
            disabled={busy}
            onClick={() => void handlePreview()}
          >
            <EyeIcon data-icon="inline-start" />
            Preview
          </LoadingButton>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || previewLoading}
              onClick={() => designerRef.current?.addPage()}
              title="Add a blank page after the current page"
            >
              <FilePlusIcon data-icon="inline-start" />
              Add page
            </Button>
          ) : null}
          {canEdit ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant={orientation === "portrait" ? "secondary" : "outline"}
                size="sm"
                disabled={busy || previewLoading || orientation === "portrait"}
                onClick={() => handleOrientation("portrait")}
                title="Portrait A4 page"
              >
                <RectangleVerticalIcon data-icon="inline-start" />
                Portrait
              </Button>
              <Button
                type="button"
                variant={orientation === "landscape" ? "secondary" : "outline"}
                size="sm"
                disabled={busy || previewLoading || orientation === "landscape"}
                onClick={() => handleOrientation("landscape")}
                title="Landscape A4 page"
              >
                <RectangleHorizontalIcon data-icon="inline-start" />
                Landscape
              </Button>
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || previewLoading}
            onClick={() => setHistoryOpen(true)}
          >
            <HistoryIcon data-icon="inline-start" />
            History
          </Button>
          {canEdit ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || previewLoading || !loaderData.canUndo}
                onClick={handleUndo}
              >
                <Undo2Icon data-icon="inline-start" />
                Undo publish
              </Button>
              {canDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || previewLoading}
                  onClick={handleReset}
                >
                  <Trash2Icon data-icon="inline-start" />
                  Delete
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || previewLoading || !canRevert}
                onClick={handleRevertChanges}
                title="Revert layout to when you opened this template, or last Save draft / Publish"
              >
                <RotateCcwIcon data-icon="inline-start" />
                Revert
              </Button>
              <LoadingButton
                type="button"
                variant="outline"
                size="sm"
                loading={busy && (intent === "draft" || intent === "autosave")}
                loadingLabel="Saving…"
                disabled={previewLoading || busy}
                onClick={() => submitTemplate("draft")}
              >
                <SaveIcon data-icon="inline-start" />
                Save draft
              </LoadingButton>
              <LoadingButton
                type="button"
                size="sm"
                loading={busy && intent === "publish"}
                loadingLabel="Publishing…"
                disabled={previewLoading || busy}
                onClick={() => submitTemplate("publish")}
              >
                <UploadIcon data-icon="inline-start" />
                Publish
              </LoadingButton>
            </>
          ) : null}
        </div>

        <PdfmeDesigner
          // Key by template identity only — version bumps after save must not
          // remount the designer (that felt like a full page refresh).
          key={docTemplate.key}
          ref={designerRef}
          template={docTemplate.template as Template}
          editable={canEdit}
          onTemplateChange={handleTemplateChange}
          className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-background"
        />
      </div>

      <DocumentTemplateHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        versions={loaderData.history}
        publishedVersionNumber={loaderData.publishedVersionNumber}
        canEdit={canEdit}
        busy={busy}
        dirty={dirty}
        unsavedChanges={unsavedChanges}
        editorName={loaderData.viewerName}
        basedOnVersion={loaderData.editingVersionNumber}
        onPreviewVersion={(entry) => void handlePreviewVersion(entry)}
        onPublishVersion={publishVersion}
        onOpenInEditor={handleOpenVersionInEditor}
        onPreviewWorkingCopy={() => void handlePreview()}
        onSaveDraft={() => submitTemplate("draft")}
      />

      <DocumentTemplateLeaveDialog
        open={leaveOpen}
        changes={unsavedChanges}
        saving={busy && intent === "draft" && pendingLeaveAfterSave}
        onStay={() => {
          setManualLeaveOpen(false);
          setPendingLeaveAfterSave(false);
          if (blocker.state === "blocked") blocker.reset?.();
        }}
        onDiscard={() => {
          allowLeaveRef.current = true;
          setManualLeaveOpen(false);
          setDirty(false);
          setUnsavedChanges([]);
          if (blocker.state === "blocked") blocker.proceed?.();
          else void navigate("/settings/document-templates");
        }}
        onSaveAndLeave={() => {
          setPendingLeaveAfterSave(true);
          submitTemplate("draft");
        }}
      />

      {canDelete ? (
        <DocumentTemplateDeleteDialog
          open={deleteOpen}
          title={displayTitle}
          deleting={busy && intent === "reset"}
          onOpenChange={setDeleteOpen}
          onConfirm={confirmDelete}
        />
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
        title={`${previewTitle} — preview`}
        description="Generated with sample policy data (not a real policy)."
        src={previewSrc}
        loading={previewLoading}
        error={previewError}
      />
    </div>
  );
}

function TemplateVersionBadges({
  publishedVersionNumber,
  editingVersionNumber,
  editingIsPublished,
  unsavedCount,
  autosaveStatus,
}: {
  publishedVersionNumber: number | null;
  editingVersionNumber: number | null;
  editingIsPublished: boolean;
  unsavedCount: number;
  autosaveStatus: "idle" | "pending" | "saving" | "saved";
}) {
  return (
    <>
      {publishedVersionNumber != null ? (
        <Badge variant="success-light" size="sm" radius="full">
          Published v{publishedVersionNumber}
        </Badge>
      ) : (
        <Badge variant="warning-light" size="sm" radius="full">
          Not published
        </Badge>
      )}
      {editingVersionNumber != null &&
      editingVersionNumber !== publishedVersionNumber ? (
        <Badge variant="warning-light" size="sm" radius="full">
          Draft v{editingVersionNumber}
        </Badge>
      ) : editingIsPublished ? (
        <Badge variant="info-light" size="sm" radius="full">
          Editing published
        </Badge>
      ) : null}
      {autosaveStatus === "saving" || autosaveStatus === "pending" ? (
        <Badge variant="secondary" size="sm" radius="full">
          {autosaveStatus === "saving" ? "Saving draft…" : "Autosave pending…"}
        </Badge>
      ) : autosaveStatus === "saved" && unsavedCount === 0 ? (
        <Badge variant="success-light" size="sm" radius="full">
          Draft saved
        </Badge>
      ) : unsavedCount > 0 ? (
        <Badge variant="destructive-light" size="sm" radius="full">
          Unsaved changes · {unsavedCount}
        </Badge>
      ) : null}
    </>
  );
}

function EditableTitle({
  displayTitle,
  value,
  canEdit,
  busy,
  editing,
  onEditingChange,
  onChange,
  onSave,
  onCancel,
}: {
  displayTitle: string;
  value: string;
  canEdit: boolean;
  busy: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <h2 className="truncate text-2xl font-semibold tracking-tight">
          {displayTitle}
        </h2>
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit title"
            disabled={busy}
            onClick={() => onEditingChange(true)}
          >
            <PencilIcon />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex max-w-xl min-w-0 flex-1 items-center gap-1.5">
      <Input
        value={value}
        autoFocus
        aria-label="Template title"
        disabled={busy}
        className="h-9 text-base font-semibold md:text-lg"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSave(value.trim() || value);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Save title"
        disabled={busy || !value.trim()}
        onClick={() => onSave(value.trim())}
      >
        <CheckIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel title edit"
        disabled={busy}
        onClick={onCancel}
      >
        <XIcon />
      </Button>
    </div>
  );
}
