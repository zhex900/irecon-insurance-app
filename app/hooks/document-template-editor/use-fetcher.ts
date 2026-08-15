import { useEffect, type RefObject } from "react";
import { toast } from "sonner";
import type { Template } from "@pdfme/common";
import type { PdfmeDesignerHandle } from "~/components/documents/pdf/designer";
import { invalidatePdfTemplateOverrideCache } from "~/lib/pdf/template-override-cache";
import type { TemplateEditorAutosaveAction } from "~/lib/documents/template-editor-autosave";

type FetcherData = {
  ok: boolean;
  error?: string;
  intent?: string;
  templateKey?: string;
  versionNumber?: number | null;
  unpublished?: boolean;
};

export function useDocumentTemplateEditorFetcher({
  fetcherState,
  fetcherData,
  handledDataRef,
  docTemplateKey,
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
  revalidate,
  navigateToList,
  setManualLeaveOpen,
  blocker,
}: {
  fetcherState: "idle" | "submitting" | "loading";
  fetcherData: FetcherData | undefined;
  handledDataRef: RefObject<FetcherData | undefined>;
  docTemplateKey: string;
  designerRef: RefObject<PdfmeDesignerHandle | null>;
  submittedTemplateRef: RefObject<Template | null>;
  baselineTemplateRef: RefObject<Template | null>;
  revertTemplateRef: RefObject<Template | null>;
  allowLeaveRef: RefObject<boolean>;
  pendingAutosaveRef: RefObject<boolean>;
  pendingLeaveAfterSaveRef: RefObject<boolean>;
  dirtyRef: RefObject<boolean>;
  scheduleAutosaveRef: RefObject<() => void>;
  syncDirtyFromBaseline: () => void;
  dispatch: (action: TemplateEditorAutosaveAction) => void;
  revalidate: () => void;
  navigateToList: () => void;
  setManualLeaveOpen: (open: boolean) => void;
  blocker: ReturnType<typeof import("react-router").useBlocker>;
}) {
  useEffect(() => {
    if (fetcherState !== "idle" || !fetcherData) return;
    if (handledDataRef.current === fetcherData) return;
    handledDataRef.current = fetcherData;
    const data = fetcherData;

    if (!data.ok) {
      queueMicrotask(() => {
        dispatch({ type: "cancel_leave" });
        dispatch({ type: "save_error", stillDirty: dirtyRef.current ?? false });
      });
      toast.error(data.error ?? "Save failed.");
      if (pendingAutosaveRef.current || dirtyRef.current) {
        pendingAutosaveRef.current = false;
        scheduleAutosaveRef.current();
      }
      return;
    }

    invalidatePdfTemplateOverrideCache(data.templateKey ?? docTemplateKey);

    if (data.intent === "reset") {
      toast.success("Template deleted");
      allowLeaveRef.current = true;
      navigateToList();
      return;
    }
    if (data.intent === "meta") {
      toast.success("Saved");
      revalidate();
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
        dispatch({ type: "publish_success" });
      });
      revalidate();
      return;
    }
    if (data.intent === "undo") {
      toast.success(
        data.unpublished
          ? "Undid publish — nothing is published for this template"
          : `Undid publish — live is now v${data.versionNumber}`,
      );
      revalidate();
      return;
    }
    if (data.intent === "delete-draft") {
      toast.success(`Deleted draft v${data.versionNumber}`);
      revalidate();
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
      dispatch(
        isAutosave ? { type: "autosave_success" } : { type: "draft_success" },
      );
      if (pendingLeaveAfterSaveRef.current && !isAutosave) {
        dispatch({ type: "leave_after_save_complete" });
        allowLeaveRef.current = true;
        setManualLeaveOpen(false);
        if (blocker.state === "blocked") blocker.proceed?.();
        else navigateToList();
        return;
      }
      if (pendingAutosaveRef.current || dirtyRef.current) {
        pendingAutosaveRef.current = false;
        scheduleAutosaveRef.current();
      }
    });
    revalidate();
  }, [
    fetcherState,
    fetcherData,
    handledDataRef,
    docTemplateKey,
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
    revalidate,
    navigateToList,
    setManualLeaveOpen,
    blocker,
  ]);
}
