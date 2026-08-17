import { useEffect } from "react";

import { useDraftOperations } from "../draft/use-draft-operations";
import { useDraftStateManagement } from "../draft/use-draft-state";
import type { UseDraftSaveProps } from "../draft/use-draft-types";
import { useDraftFieldWatching } from "../draft/use-draft-watching";

export function usePolicyDraftSave(props: UseDraftSaveProps) {
  const { form, premiumRef, premiumManualKeysRef, draftSaveSyncRef } = props;

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
    cancelQueuedDraftSave,
    waitForDraftIdle,
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

  useEffect(() => {
    if (!draftSaveSyncRef) return;
    draftSaveSyncRef.current = { cancelQueuedDraftSave, waitForDraftIdle };
  }, [draftSaveSyncRef, cancelQueuedDraftSave, waitForDraftIdle]);

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
    cancelQueuedDraftSave,
    waitForDraftIdle,
  };
}

// Re-export types for external consumers
export type { PolicyLeaveApi } from "../draft/use-draft-types";
export type { UseDraftSaveProps } from "../draft/use-draft-types";
