import { useCallback, useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { NavigateFunction } from "react-router";

import type { PolicySaveStatus } from "~/components/forms/field-save-highlight";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import {
  beginDraftSave,
  discardInFlightDraft,
  type DraftPersistRefs,
  type DraftPersistSetters,
  finishDraftSaveAttempt,
  queueFollowUpDraftSave,
  queueInFlightDraftSave,
  waitWhileDraftSaving,
} from "./draft-persist";
import type { PolicyLeaveApi } from "./use-draft-types";
import { createDraftSnapshot, SaveEpochTracker } from "./use-draft-utils";

export function useDraftOperations({
  policy,
  form,
  premiumRef,
  premiumManualKeysRef,
  premiumManuallyEditedRef,
  getDirtyPaths,
  commitSavedPaths,
  rollbackSavedPaths,
  refreshPremiumAfterSave,
  getLeaveApi,
  navigate,
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
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  premiumRef: React.RefObject<PremiumBreakdown | undefined>;
  premiumManualKeysRef: React.RefObject<string[]>;
  premiumManuallyEditedRef: React.RefObject<boolean>;
  getDirtyPaths: () => string[];
  commitSavedPaths: (paths: string[]) => void;
  rollbackSavedPaths: (paths: string[]) => void;
  refreshPremiumAfterSave: (dirtyPaths: string[]) => void;
  getLeaveApi: () => PolicyLeaveApi | null;
  navigate: NavigateFunction;
  fieldsLocked: boolean;
  hasUnsavedChangesRef: React.RefObject<boolean>;
  isSavingDraftRef: React.RefObject<boolean>;
  pendingSaveAfterCurrentRef: React.RefObject<boolean>;
  pendingSkipPremiumRefreshRef: React.RefObject<boolean>;
  lastHandledSavedAtRef: React.RefObject<string | null>;
  pendingDraftPayloadRef: React.RefObject<string | null>;
  pendingDirtyPathsRef: React.RefObject<string[]>;
  saveEpochTracker: React.RefObject<SaveEpochTracker>;
  savedSnapshotRef: React.RefObject<string>;
  previousSnapshotRef: React.RefObject<string>;
  previousSavedAtRef: React.RefObject<string | null>;
  setDraftSavedAt: (value: string | null) => void;
  setDraftSaveError: (value: string | null) => void;
  setHasUnsavedChanges: (value: boolean) => void;
  setManualSaving: (value: boolean) => void;
  publishSaveStatus: (status: PolicySaveStatus) => void;
}) {
  const refs = useMemo<DraftPersistRefs>(
    () => ({
      hasUnsavedChangesRef,
      isSavingDraftRef,
      pendingSaveAfterCurrentRef,
      pendingSkipPremiumRefreshRef,
      lastHandledSavedAtRef,
      pendingDraftPayloadRef,
      pendingDirtyPathsRef,
      savedSnapshotRef,
      previousSnapshotRef,
      previousSavedAtRef,
      premiumManuallyEditedRef,
      saveEpochTracker,
    }),
    [
      hasUnsavedChangesRef,
      isSavingDraftRef,
      pendingSaveAfterCurrentRef,
      pendingSkipPremiumRefreshRef,
      lastHandledSavedAtRef,
      pendingDraftPayloadRef,
      pendingDirtyPathsRef,
      savedSnapshotRef,
      previousSnapshotRef,
      previousSavedAtRef,
      premiumManuallyEditedRef,
      saveEpochTracker,
    ],
  );
  const setters = useMemo<DraftPersistSetters>(
    () => ({
      setHasUnsavedChanges,
      setDraftSavedAt,
      setDraftSaveError,
      commitSavedPaths,
      rollbackSavedPaths,
      publishSaveStatus,
      refreshPremiumAfterSave,
    }),
    [
      setHasUnsavedChanges,
      setDraftSavedAt,
      setDraftSaveError,
      commitSavedPaths,
      rollbackSavedPaths,
      publishSaveStatus,
      refreshPremiumAfterSave,
    ],
  );

  const draftSnapshot = useCallback(
    (values: CarPolicyFormValues = form.getValues()) => {
      return createDraftSnapshot(
        values,
        premiumRef.current,
        premiumManualKeysRef.current,
      );
    },
    [form, premiumRef, premiumManualKeysRef],
  );

  const persistDraft = useCallback(
    async ({
      force = false,
      skipPremiumRefresh = false,
    } = {}): Promise<boolean> => {
      if (fieldsLocked) return false;
      if (isSavingDraftRef.current) {
        queueInFlightDraftSave({ ...refs, skipPremiumRefresh });
        return false;
      }
      if (!force && !hasUnsavedChangesRef.current) return false;

      const { epoch, payload } = beginDraftSave({
        refs,
        setters,
        form,
        getDirtyPaths,
        draftSnapshot,
      });
      try {
        return await finishDraftSaveAttempt({
          epoch,
          refs,
          setters,
          leave: getLeaveApi(),
          form,
          draftSnapshot,
          skipPremiumRefresh,
          policyNumber: policy.policyNumber,
          payload,
          clientId: policy.clientId,
          navigate,
          policyId: policy.policyId,
          premium: premiumRef.current,
          premiumManualKeys: premiumManualKeysRef.current,
        });
      } finally {
        queueFollowUpDraftSave({ epoch, refs, persistDraft });
      }
    },
    [
      fieldsLocked,
      refs,
      setters,
      isSavingDraftRef,
      hasUnsavedChangesRef,
      getLeaveApi,
      getDirtyPaths,
      form,
      premiumRef,
      premiumManualKeysRef,
      draftSnapshot,
      policy.policyId,
      policy.clientId,
      policy.policyNumber,
      navigate,
    ],
  );

  const submitDraft = useCallback(() => {
    void persistDraft();
  }, [persistDraft]);

  const saveDraftNow = useCallback(async () => {
    setManualSaving(true);
    try {
      return await persistDraft({ force: true });
    } finally {
      setManualSaving(false);
    }
  }, [persistDraft, setManualSaving]);

  const handleFieldBlur = useCallback(() => {
    if (fieldsLocked) return;
    if (!hasUnsavedChangesRef.current) return;
    submitDraft();
  }, [fieldsLocked, hasUnsavedChangesRef, submitDraft]);

  const cancelQueuedDraftSave = useCallback(() => {
    discardInFlightDraft(refs);
  }, [refs]);

  const waitForDraftIdle = useCallback(() => {
    return waitWhileDraftSaving(isSavingDraftRef);
  }, [isSavingDraftRef]);

  return {
    draftSnapshot,
    persistDraft,
    submitDraft,
    saveDraftNow,
    handleFieldBlur,
    cancelQueuedDraftSave,
    waitForDraftIdle,
  };
}
