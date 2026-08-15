import { useCallback } from "react";
import { savePolicyDraftClient } from "~/lib/services/policy/draft.client";
import { flattenDirtyPaths } from "~/components/forms/field-save-highlight";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import type { UseFormReturn } from "react-hook-form";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import type { PolicyLeaveApi } from "../composite/use-draft-save";
import type { NavigateFunction } from "react-router";
import type { PolicySaveStatus } from "~/components/forms/field-save-highlight";
import {
  createDraftSnapshot,
  toastPolicyDraftSaved,
  validateSavedPaths,
  SaveEpochTracker,
} from "./use-draft-utils";

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
        // Do not drop blur/Save while a request is in flight — save again when done.
        pendingSaveAfterCurrentRef.current = true;
        if (skipPremiumRefresh) pendingSkipPremiumRefreshRef.current = true;
        return false;
      }
      if (!force && !hasUnsavedChangesRef.current) return false;

      const leave = getLeaveApi();
      const dirtyFromHighlight = getDirtyPaths();
      const dirtyFromRhf = flattenDirtyPaths(form.formState.dirtyFields);
      pendingDirtyPathsRef.current =
        dirtyFromHighlight.length > 0 ? dirtyFromHighlight : dirtyFromRhf;
      const pathsToValidate = [...pendingDirtyPathsRef.current];

      const values = {
        ...form.getValues(),
        ...(premiumRef.current ? { premium: premiumRef.current } : {}),
        premiumManualKeys: premiumManualKeysRef.current,
      };
      const payload = draftSnapshot();
      pendingDraftPayloadRef.current = payload;

      // --- Optimistic UI (in-place, no "Saving…" flicker) ---
      const epoch = saveEpochTracker.current.increment();
      previousSnapshotRef.current = savedSnapshotRef.current;
      previousSavedAtRef.current = lastHandledSavedAtRef.current;
      const optimisticSavedAt = new Date().toISOString();

      savedSnapshotRef.current = payload;
      hasUnsavedChangesRef.current = false;
      setHasUnsavedChanges(false);
      setDraftSaveError(null);
      setDraftSavedAt(optimisticSavedAt);
      commitSavedPaths(pendingDirtyPathsRef.current);
      publishSaveStatus("saved");
      validateSavedPaths(form, pathsToValidate);

      isSavingDraftRef.current = true;
      pendingSaveAfterCurrentRef.current = false;

      try {
        const data = await savePolicyDraftClient(policy.policyId, values);

        // A newer save started — ignore this response for UI.
        if (!saveEpochTracker.current.isCurrent(epoch)) return false;

        if (!data.ok) {
          // Roll back optimistic UI
          savedSnapshotRef.current = previousSnapshotRef.current;
          setDraftSavedAt(previousSavedAtRef.current);
          hasUnsavedChangesRef.current = true;
          setHasUnsavedChanges(true);
          rollbackSavedPaths(pendingDirtyPathsRef.current);
          const policyNumberError = data.errors?.policyNumber?.[0];
          if (policyNumberError) {
            form.setError("policyNumber", {
              type: "server",
              message: policyNumberError,
            });
          }
          setDraftSaveError(
            data.formError ??
              "Draft could not be saved. Check the form and try again.",
          );
          publishSaveStatus("error");
          if (leave?.pendingLeaveAfterSaveRef.current) {
            leave.pendingLeaveAfterSaveRef.current = false;
            leave.setPendingLeaveAfterSave(false);
          }
          return false;
        }

        form.clearErrors("policyNumber");
        lastHandledSavedAtRef.current = data.savedAt;
        setDraftSavedAt(data.savedAt);
        setDraftSaveError(null);

        const currentPayload = draftSnapshot();
        const editedDuringSave =
          !pendingDraftPayloadRef.current ||
          pendingDraftPayloadRef.current !== currentPayload;

        if (editedDuringSave) {
          // Keep optimistic clear for what we saved; watch will mark new edits unsaved.
          savedSnapshotRef.current = pendingDraftPayloadRef.current ?? payload;
          hasUnsavedChangesRef.current = true;
          setHasUnsavedChanges(true);
          pendingSaveAfterCurrentRef.current = true;
        } else {
          savedSnapshotRef.current = currentPayload;
          hasUnsavedChangesRef.current = false;
          setHasUnsavedChanges(false);
          publishSaveStatus("saved");
        }

        // Server recalculate zeros ES/DH and uses base×τ only — never run it after
        // a Premium Breakdown manual edit (client CalculatePremium already ran).
        if (!skipPremiumRefresh && !premiumManuallyEditedRef.current) {
          refreshPremiumAfterSave(pendingDirtyPathsRef.current);
        }
        toastPolicyDraftSaved(
          policy.policyNumber,
          pendingDirtyPathsRef.current,
        );

        if (leave?.pendingLeaveAfterSaveRef.current && !editedDuringSave) {
          leave.pendingLeaveAfterSaveRef.current = false;
          leave.setPendingLeaveAfterSave(false);
          leave.setDiscardConfirmOpen(false);
          leave.allowLeaveRef.current = true;
          const destination =
            leave.pendingLeaveDestinationRef.current ??
            `/clients/${policy.clientId}`;
          leave.pendingLeaveDestinationRef.current = null;
          if (leave.blocker.state === "blocked") {
            leave.blocker.proceed();
          } else {
            navigate(destination);
          }
        }
        return true;
      } catch {
        if (!saveEpochTracker.current.isCurrent(epoch)) return false;
        savedSnapshotRef.current = previousSnapshotRef.current;
        setDraftSavedAt(previousSavedAtRef.current);
        hasUnsavedChangesRef.current = true;
        setHasUnsavedChanges(true);
        rollbackSavedPaths(pendingDirtyPathsRef.current);
        setDraftSaveError("Draft could not be saved. Check your connection.");
        publishSaveStatus("error");
        if (leave?.pendingLeaveAfterSaveRef.current) {
          leave.pendingLeaveAfterSaveRef.current = false;
          leave.setPendingLeaveAfterSave(false);
        }
        return false;
      } finally {
        if (saveEpochTracker.current.isCurrent(epoch)) {
          isSavingDraftRef.current = false;
          if (pendingSaveAfterCurrentRef.current) {
            pendingSaveAfterCurrentRef.current = false;
            const skipPremiumRefresh = pendingSkipPremiumRefreshRef.current;
            pendingSkipPremiumRefreshRef.current = false;
            queueMicrotask(() => {
              void persistDraft({ force: true, skipPremiumRefresh });
            });
          }
        }
      }
    },
    [
      fieldsLocked,
      isSavingDraftRef,
      pendingSaveAfterCurrentRef,
      pendingSkipPremiumRefreshRef,
      hasUnsavedChangesRef,
      getLeaveApi,
      getDirtyPaths,
      form,
      premiumRef,
      premiumManualKeysRef,
      draftSnapshot,
      saveEpochTracker,
      savedSnapshotRef,
      previousSnapshotRef,
      previousSavedAtRef,
      lastHandledSavedAtRef,
      pendingDirtyPathsRef,
      pendingDraftPayloadRef,
      setHasUnsavedChanges,
      setDraftSaveError,
      setDraftSavedAt,
      commitSavedPaths,
      publishSaveStatus,
      policy.policyId,
      policy.clientId,
      policy.policyNumber,
      rollbackSavedPaths,
      refreshPremiumAfterSave,
      premiumManuallyEditedRef,
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

  return {
    draftSnapshot,
    persistDraft,
    submitDraft,
    saveDraftNow,
    handleFieldBlur,
  };
}
