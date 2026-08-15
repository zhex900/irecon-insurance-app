import { useEffect } from "react";
import type { UseDraftSaveProps } from "../draft/use-draft-types";
import { useDraftStateManagement } from "../draft/use-draft-state";
import { useDraftFieldWatching } from "../draft/use-draft-watching";
import { useDraftOperations } from "../draft/use-draft-operations";

export function usePolicyDraftSave(props: UseDraftSaveProps) {
  const { form, premiumRef, premiumManualKeysRef } = props;

  // State management
  const {
    draftSavedAt,
    setDraftSavedAt,
    draftSaveError,
    setDraftSaveError,
    manualSaving,
    setManualSaving,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    saveStatus,
    publishSaveStatus,
    hasUnsavedChangesRef,
    isSavingDraftRef,
    pendingSaveAfterCurrentRef,
    pendingSkipPremiumRefreshRef,
    lastHandledSavedAtRef,
    pendingDraftPayloadRef,
    pendingDirtyPathsRef,
    lastStatusRef: _lastStatusRef,
    saveEpochTracker,
    savedSnapshotRef,
    previousSnapshotRef,
    previousSavedAtRef,
    fieldsLocked,
  } = useDraftStateManagement({
    form,
    premiumRef,
    premiumManualKeysRef,
  });

  // Field watching for unsaved changes
  useDraftFieldWatching({
    form,
    premiumRef,
    premiumManualKeysRef,
    premiumManuallyEditedRef: props.premiumManuallyEditedRef,
    savedSnapshotRef,
    setHasUnsavedChanges,
  });

  // Save operations
  const {
    draftSnapshot,
    persistDraft,
    submitDraft,
    saveDraftNow,
    handleFieldBlur,
  } = useDraftOperations({
    ...props,
    fieldsLocked,
    hasUnsavedChangesRef,
    isSavingDraftRef,
    pendingSaveAfterCurrentRef,
    pendingSkipPremiumRefreshRef,
    lastHandledSavedAtRef,
    pendingDraftPayloadRef,
    pendingDirtyPathsRef,
    saveEpochTracker,
    savedSnapshotRef,
    previousSnapshotRef,
    previousSavedAtRef,
    setDraftSavedAt,
    setDraftSaveError,
    setHasUnsavedChanges,
    setManualSaving,
    publishSaveStatus,
  });

  // Seed the saved snapshot once on mount
  useEffect(() => {
    const initial = draftSnapshot();
    savedSnapshotRef.current = initial;
    previousSnapshotRef.current = initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-time snapshot seed on mount
  }, []);

  return {
    draftSavedAt,
    draftSaveError,
    setDraftSaveError,
    manualSaving,
    hasUnsavedChanges,
    hasUnsavedChangesRef,
    setHasUnsavedChanges,
    saveStatus,
    savedSnapshotRef,
    persistDraft,
    submitDraft,
    saveDraftNow,
    handleFieldBlur,
    draftSnapshot,
  };
}

// Re-export types for external consumers
export type { PolicyLeaveApi } from "../draft/use-draft-types";
export type { UseDraftSaveProps } from "../draft/use-draft-types";
