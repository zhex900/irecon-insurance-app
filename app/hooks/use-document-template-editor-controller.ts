import { useEffect, useReducer, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  useBlocker,
  useFetcher,
  useNavigate,
  useRevalidator,
} from "react-router";
import type { Template } from "@pdfme/common";
import { toast } from "sonner";
import type { PdfmeDesignerHandle } from "~/components/documents/pdfme-designer";
import { collectMergeFields } from "~/lib/documents/template-editor-form";
import {
  diffDirtyState,
  initialTemplateEditorAutosaveState,
  templateEditorAutosaveReducer,
} from "~/lib/documents/template-editor-autosave";
import { useDocumentTemplateEditorFetcher } from "~/hooks/use-document-template-editor-fetcher";
import {
  getTemplateOrientation,
  type DocumentPageOrientation,
} from "~/lib/pdf/templates";
import type { DocumentTemplateHistoryEntry } from "~/lib/services/documents/document-template-history";
import type { DocumentTemplateEditorLoaderData } from "~/lib/documents/template-editor-types";

type FetcherData = {
  ok: boolean;
  error?: string;
  intent?: string;
  templateKey?: string;
  versionNumber?: number | null;
  unpublished?: boolean;
};

export type DocumentTemplateConfirmAction =
  | { kind: "revert" }
  | { kind: "publish"; versionNumber: number }
  | { kind: "undo" }
  | { kind: "load-version"; entry: DocumentTemplateHistoryEntry }
  | { kind: "delete-draft"; versionNumber: number };

export function useDocumentTemplateEditorController({
  loaderData,
  designerRef,
  fetchHistoryVersionTemplate,
  onPreviewTemplate,
}: {
  loaderData: DocumentTemplateEditorLoaderData;
  designerRef: RefObject<PdfmeDesignerHandle | null>;
  fetchHistoryVersionTemplate: (versionNumber: number) => Promise<Template>;
  onPreviewTemplate: (template: Template, title: string) => Promise<void>;
}) {
  const { template: docTemplate, canEdit, canDelete } = loaderData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const fetcher = useFetcher<FetcherData>();

  const handledDataRef = useRef<typeof fetcher.data>(undefined);
  const baselineTemplateRef = useRef<Template | null>(null);
  const revertTemplateRef = useRef<Template | null>(null);
  const allowLeaveRef = useRef(false);
  const submittedTemplateRef = useRef<Template | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAutosaveRef = useRef(false);
  const pendingLeaveAfterSaveRef = useRef(false);
  const fetcherStateRef = useRef(fetcher.state);
  const scheduleAutosaveRef = useRef<() => void>(() => {});

  fetcherStateRef.current = fetcher.state;

  const [editorState, dispatch] = useReducer(
    templateEditorAutosaveReducer,
    initialTemplateEditorAutosaveState,
  );
  pendingLeaveAfterSaveRef.current = editorState.pendingLeaveAfterSave;

  const [orientation, setOrientation] = useState<DocumentPageOrientation>(() =>
    getTemplateOrientation(docTemplate.template as Template),
  );
  const [titleValue, setTitleValue] = useState(docTemplate.title);
  const [labelValue, setLabelValue] = useState(docTemplate.label);
  const [coverTypeValue, setCoverTypeValue] = useState(
    docTemplate.coverTypeId == null ? "all" : String(docTemplate.coverTypeId),
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [manualLeaveOpen, setManualLeaveOpen] = useState(false);
  const [confirmAction, setConfirmAction] =
    useState<DocumentTemplateConfirmAction | null>(null);

  const busy = fetcher.state !== "idle";
  const dirty = editorState.dirty;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (editorState.autosaveStatus !== "saved") return;
    const timer = setTimeout(() => {
      dispatch({ type: "saved_indicator_elapsed" });
    }, 2500);
    return () => clearTimeout(timer);
  }, [editorState.autosaveStatus]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowLeaveRef.current) return false;
    if (currentLocation.pathname === nextLocation.pathname) return false;
    return dirty;
  });

  const leaveOpen = manualLeaveOpen || blocker.state === "blocked";

  function syncDirtyFromBaseline() {
    const { changes, canRevert } = diffDirtyState(
      baselineTemplateRef.current,
      designerRef.current?.getTemplate() ?? null,
      revertTemplateRef.current,
    );
    dispatch({
      type: "template_diff",
      changes,
      canRevert,
    });
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
    dispatch({ type: "schedule_autosave" });
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      runAutosave();
    }, 1500);
  }
  scheduleAutosaveRef.current = scheduleAutosave;

  function runAutosave() {
    if (!canEdit || !dirtyRef.current) {
      dispatch({ type: "clear_autosave_timer" });
      return;
    }
    if (fetcherStateRef.current !== "idle") {
      pendingAutosaveRef.current = true;
      return;
    }
    submitTemplate("autosave");
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
    if (intent === "autosave") dispatch({ type: "autosave_submit" });
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

  function handleTemplateChange(next: Template) {
    setOrientation(getTemplateOrientation(next));
    if (!baselineTemplateRef.current) {
      baselineTemplateRef.current = next;
      if (!revertTemplateRef.current) revertTemplateRef.current = next;
      dispatch({ type: "baseline_seeded" });
      return;
    }
    const {
      changes,
      dirty: nextDirty,
      canRevert,
    } = diffDirtyState(
      baselineTemplateRef.current,
      next,
      revertTemplateRef.current,
    );
    dispatch({ type: "template_diff", changes, canRevert });
    if (nextDirty && canEdit) {
      scheduleAutosave();
    } else {
      clearAutosaveTimer();
      dispatch({ type: "clear_autosave_timer" });
    }
  }

  function handleOrientation(next: DocumentPageOrientation) {
    if (!canEdit) return;
    designerRef.current?.setOrientation(next);
    setOrientation(next);
  }

  function handleRevertChanges() {
    if (!canEdit || !editorState.canRevert) return;
    const checkpoint = revertTemplateRef.current;
    const designer = designerRef.current;
    if (!checkpoint || !designer) {
      toast.error("Nothing to revert to yet.");
      return;
    }
    setConfirmAction({ kind: "revert" });
  }

  function confirmRevertChanges() {
    const checkpoint = revertTemplateRef.current;
    const designer = designerRef.current;
    if (!checkpoint || !designer) {
      setConfirmAction(null);
      toast.error("Nothing to revert to yet.");
      return;
    }

    clearAutosaveTimer();
    pendingAutosaveRef.current = false;
    baselineTemplateRef.current = null;
    revertTemplateRef.current = null;
    designer.updateTemplate(checkpoint);

    queueMicrotask(() => {
      const current = designer.getTemplate();
      if (current) {
        baselineTemplateRef.current = current;
        revertTemplateRef.current = current;
      }
      dispatch({ type: "reverted" });
      submitTemplate("autosave");
      toast.success("Changes reverted");
    });
    setConfirmAction(null);
  }

  function publishVersion(versionNumber: number) {
    if (!canEdit) return;
    setConfirmAction({ kind: "publish", versionNumber });
  }

  function deleteDraft(versionNumber: number) {
    if (!canEdit) return;
    setConfirmAction({ kind: "delete-draft", versionNumber });
  }

  function confirmPublishVersion(versionNumber: number) {
    const formData = new FormData();
    formData.set("intent", "publish-version");
    formData.set("versionNumber", String(versionNumber));
    fetcher.submit(formData, { method: "post" });
    setConfirmAction(null);
  }

  function confirmDeleteDraft(versionNumber: number) {
    const formData = new FormData();
    formData.set("intent", "delete-draft");
    formData.set("versionNumber", String(versionNumber));
    fetcher.submit(formData, { method: "post" });
    setConfirmAction(null);
  }

  function navigateToList() {
    allowLeaveRef.current = true;
    void navigate("/settings/document-templates");
  }

  function requestLeaveToList() {
    if (dirty) {
      setManualLeaveOpen(true);
      return;
    }
    navigateToList();
  }

  function discardLeave() {
    allowLeaveRef.current = true;
    setManualLeaveOpen(false);
    dispatch({ type: "discard_leave" });
    if (blocker.state === "blocked") blocker.proceed?.();
    else navigateToList();
  }

  function cancelLeave() {
    setManualLeaveOpen(false);
    dispatch({ type: "cancel_leave" });
    if (blocker.state === "blocked") blocker.reset?.();
  }

  function handleUndo() {
    if (!canEdit || !loaderData.canUndo) return;
    setConfirmAction({ kind: "undo" });
  }

  function confirmUndo() {
    const formData = new FormData();
    formData.set("intent", "undo");
    fetcher.submit(formData, { method: "post" });
    setConfirmAction(null);
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
    await onPreviewTemplate(template, docTemplate.title);
  }

  async function handlePreviewVersion(entry: DocumentTemplateHistoryEntry) {
    try {
      const template = await fetchHistoryVersionTemplate(entry.versionNumber);
      await onPreviewTemplate(template, entry.title);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load version",
      );
    }
  }

  function handleOpenVersionInEditor(entry: DocumentTemplateHistoryEntry) {
    if (!canEdit) return;
    const designer = designerRef.current;
    if (!designer) {
      toast.error("Designer is not ready yet.");
      return;
    }
    if (dirty) {
      setConfirmAction({ kind: "load-version", entry });
      return;
    }
    void loadVersionInEditor(entry);
  }

  async function loadVersionInEditor(entry: DocumentTemplateHistoryEntry) {
    const designer = designerRef.current;
    if (!designer) {
      toast.error("Designer is not ready yet.");
      return;
    }

    try {
      const template = await fetchHistoryVersionTemplate(entry.versionNumber);
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
  }

  function confirmLoadVersionInEditor(entry: DocumentTemplateHistoryEntry) {
    setConfirmAction(null);
    void loadVersionInEditor(entry);
  }

  function resolveConfirmAction() {
    if (!confirmAction) return;
    switch (confirmAction.kind) {
      case "revert":
        confirmRevertChanges();
        break;
      case "publish":
        confirmPublishVersion(confirmAction.versionNumber);
        break;
      case "undo":
        confirmUndo();
        break;
      case "load-version":
        confirmLoadVersionInEditor(confirmAction.entry);
        break;
      case "delete-draft":
        confirmDeleteDraft(confirmAction.versionNumber);
        break;
    }
  }

  useDocumentTemplateEditorFetcher({
    fetcherState: fetcher.state,
    fetcherData: fetcher.data,
    handledDataRef,
    docTemplateKey: docTemplate.key,
    designerRef,
    submittedTemplateRef,
    baselineTemplateRef,
    revertTemplateRef,
    allowLeaveRef,
    pendingAutosaveRef,
    pendingLeaveAfterSaveRef,
    dirtyRef,
    scheduleAutosaveRef,
    syncDirtyFromBaseline,
    dispatch,
    revalidate: () => revalidator.revalidate(),
    navigateToList,
    setManualLeaveOpen,
    blocker,
  });

  const intent = String(fetcher.formData?.get("intent") ?? "");

  return {
    docTemplate,
    canEdit,
    canDelete,
    busy,
    intent,
    orientation,
    titleValue,
    labelValue,
    coverTypeValue,
    editingTitle,
    historyOpen,
    deleteOpen,
    leaveOpen,
    confirmAction,
    setConfirmAction,
    resolveConfirmAction,
    dirty,
    unsavedChanges: editorState.unsavedChanges,
    canRevert: editorState.canRevert,
    autosaveStatus: editorState.autosaveStatus,
    pendingLeaveAfterSave: editorState.pendingLeaveAfterSave,
    blocker,
    setTitleValue,
    setLabelValue,
    setCoverTypeValue,
    setEditingTitle,
    setHistoryOpen,
    setDeleteOpen,
    setManualLeaveOpen,
    submitMeta,
    submitTemplate,
    publishVersion,
    deleteDraft,
    navigateToList,
    requestLeaveToList,
    discardLeave,
    cancelLeave,
    handleUndo,
    handleReset,
    confirmDelete,
    handlePreview,
    handlePreviewVersion,
    handleRevertChanges,
    handleOrientation,
    handleTemplateChange,
    handleOpenVersionInEditor,
    dispatch,
  };
}
