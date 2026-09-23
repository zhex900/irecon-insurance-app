import type { Template } from "@pdfme/common";
import type { RefObject } from "react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  useBlocker,
  useFetcher,
  useNavigate,
  useRevalidator,
} from "react-router";
import { toast } from "sonner";

import type { PdfmeDesignerHandle } from "~/components/documents/pdf/designer";
import {
  diffDirtyState,
  initialTemplateEditorAutosaveState,
  templateEditorAutosaveReducer,
} from "~/lib/documents/template-editor-autosave";
import { collectMergeFields } from "~/lib/documents/template-editor-form";
import type { DocumentTemplateEditorLoaderData } from "~/lib/documents/template-editor-types";
import {
  type DocumentPageOrientation,
  getTemplateOrientation,
} from "~/lib/pdf/templates";
import type { DocumentTemplateHistoryEntry } from "~/lib/services/documents/document-template-history";

import {
  useDocumentTemplateEditorAutosaveFetcher,
  useDocumentTemplateEditorFetcher,
} from "./use-fetcher";

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
  const saveFetcher = useFetcher<FetcherData>();
  const autosaveFetcher = useFetcher<FetcherData>();

  const handledSaveDataRef = useRef<typeof saveFetcher.data>(undefined);
  const handledAutosaveDataRef = useRef<typeof autosaveFetcher.data>(undefined);
  const baselineTemplateRef = useRef<Template | null>(null);
  const revertTemplateRef = useRef<Template | null>(null);
  const allowLeaveRef = useRef(false);
  const submittedTemplateRef = useRef<Template | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAutosaveRef = useRef(false);
  const pendingLeaveAfterSaveRef = useRef(false);
  const saveFetcherStateRef = useRef(saveFetcher.state);
  const autosaveFetcherStateRef = useRef(autosaveFetcher.state);
  const scheduleAutosaveRef = useRef<() => void>(() => {});

  saveFetcherStateRef.current = saveFetcher.state;
  autosaveFetcherStateRef.current = autosaveFetcher.state;

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
  const [historyOpen, setHistoryOpenState] = useState(false);
  const [editingVersionNumber, setEditingVersionNumber] = useState(
    loaderData.editingVersionNumber,
  );
  const [editingIsPublished, setEditingIsPublished] = useState(
    loaderData.editingIsPublished,
  );
  const [publishedVersionNumber, setPublishedVersionNumber] = useState(
    loaderData.publishedVersionNumber,
  );
  const [canUndo, setCanUndo] = useState(loaderData.canUndo);
  const [history, setHistory] = useState(loaderData.history);

  useEffect(() => {
    setEditingVersionNumber(loaderData.editingVersionNumber);
    setEditingIsPublished(loaderData.editingIsPublished);
    setPublishedVersionNumber(loaderData.publishedVersionNumber);
    setCanUndo(loaderData.canUndo);
  }, [
    loaderData.editingVersionNumber,
    loaderData.editingIsPublished,
    loaderData.publishedVersionNumber,
    loaderData.canUndo,
  ]);

  useEffect(() => {
    setHistory(loaderData.history);
  }, [loaderData.history]);

  const setHistoryOpen = useCallback(
    (open: boolean) => {
      setHistoryOpenState(open);
      if (open) revalidator.revalidate();
    },
    [revalidator],
  );

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [manualLeaveOpen, setManualLeaveOpen] = useState(false);
  const [confirmAction, setConfirmAction] =
    useState<DocumentTemplateConfirmAction | null>(null);

  const busy = saveFetcher.state !== "idle";
  const dirty = editorState.dirty;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

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
    if (
      saveFetcherStateRef.current !== "idle" ||
      autosaveFetcherStateRef.current !== "idle"
    ) {
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
    saveFetcher.submit(formData, { method: "post" });
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
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("template", JSON.stringify(template));
    formData.set("flowPushDown", JSON.stringify(docTemplate.flowPushDown));
    formData.set(
      "mergeFields",
      JSON.stringify(collectMergeFields(template, docTemplate.mergeFields)),
    );
    const fetcher = intent === "autosave" ? autosaveFetcher : saveFetcher;
    fetcher.submit(formData, { method: "post" });
  }

  function handleTemplateChange(next: Template) {
    const nextOrientation = getTemplateOrientation(next);
    setOrientation((prev) =>
      prev === nextOrientation ? prev : nextOrientation,
    );
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
    saveFetcher.submit(formData, { method: "post" });
    setConfirmAction(null);
  }

  function confirmDeleteDraft(versionNumber: number) {
    const formData = new FormData();
    formData.set("intent", "delete-draft");
    formData.set("versionNumber", String(versionNumber));
    saveFetcher.submit(formData, { method: "post" });
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
    if (!canEdit || !canUndo) return;
    setConfirmAction({ kind: "undo" });
  }

  function confirmUndo() {
    const formData = new FormData();
    formData.set("intent", "undo");
    saveFetcher.submit(formData, { method: "post" });
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
    saveFetcher.submit(formData, { method: "post" });
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
    fetcherState: saveFetcher.state,
    fetcherData: saveFetcher.data,
    handledDataRef: handledSaveDataRef,
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

  useDocumentTemplateEditorAutosaveFetcher({
    fetcherState: autosaveFetcher.state,
    fetcherData: autosaveFetcher.data,
    handledDataRef: handledAutosaveDataRef,
    docTemplateKey: docTemplate.key,
    submittedTemplateRef,
    baselineTemplateRef,
    pendingAutosaveRef,
    dirtyRef,
    scheduleAutosaveRef,
    syncDirtyFromBaseline,
  });

  const intent = String(saveFetcher.formData?.get("intent") ?? "");

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
    editingVersionNumber,
    editingIsPublished,
    publishedVersionNumber,
    canUndo,
    history,
    deleteOpen,
    leaveOpen,
    confirmAction,
    setConfirmAction,
    resolveConfirmAction,
    dirty,
    unsavedChanges: editorState.unsavedChanges,
    canRevert: editorState.canRevert,
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
