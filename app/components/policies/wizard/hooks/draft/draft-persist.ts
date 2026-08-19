import type { UseFormReturn } from "react-hook-form";
import type { NavigateFunction } from "react-router";

import type { PolicySaveStatus } from "~/components/forms/field-save-highlight";
import { flattenDirtyPaths } from "~/components/forms/field-save-highlight";
import type { PremiumBreakdown } from "~/lib/db/types";
import { savePolicyDraftClient } from "~/lib/services/policy/draft.client";
import type { DraftSaveResult } from "~/lib/services/shared/draft-result";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import type { PolicyLeaveApi } from "./use-draft-types";
import {
  SaveEpochTracker,
  toastPolicyDraftSaved,
  validateSavedPaths,
} from "./use-draft-utils";

type RefBox<T> = { current: T };

export type DraftPersistRefs = {
  hasUnsavedChangesRef: RefBox<boolean>;
  isSavingDraftRef: RefBox<boolean>;
  pendingSaveAfterCurrentRef: RefBox<boolean>;
  pendingSkipPremiumRefreshRef: RefBox<boolean>;
  lastHandledSavedAtRef: RefBox<string | null>;
  pendingDraftPayloadRef: RefBox<string | null>;
  pendingDirtyPathsRef: RefBox<string[]>;
  savedSnapshotRef: RefBox<string>;
  previousSnapshotRef: RefBox<string>;
  previousSavedAtRef: RefBox<string | null>;
  premiumManuallyEditedRef: RefBox<boolean>;
  saveEpochTracker: RefBox<SaveEpochTracker>;
};

export type DraftPersistSetters = {
  setHasUnsavedChanges: (value: boolean) => void;
  setDraftSavedAt: (value: string | null) => void;
  setDraftSaveError: (value: string | null) => void;
  commitSavedPaths: (paths: string[]) => void;
  rollbackSavedPaths: (paths: string[]) => void;
  publishSaveStatus: (status: PolicySaveStatus) => void;
  refreshPremiumAfterSave: (dirtyPaths: string[]) => void;
};

export function collectDraftDirtyPaths(
  highlightPaths: string[],
  rhfDirtyFields: unknown,
): string[] {
  if (highlightPaths.length > 0) return highlightPaths;
  return flattenDirtyPaths(rhfDirtyFields);
}

export function buildDraftSaveValues(
  form: UseFormReturn<CarPolicyFormValues>,
  premium: PremiumBreakdown | undefined,
  premiumManualKeys: string[],
) {
  return {
    ...form.getValues(),
    ...(premium ? { premium } : {}),
    premiumManualKeys,
  };
}

export function queueInFlightDraftSave(options: {
  pendingSaveAfterCurrentRef: RefBox<boolean>;
  pendingSkipPremiumRefreshRef: RefBox<boolean>;
  skipPremiumRefresh: boolean;
}): void {
  options.pendingSaveAfterCurrentRef.current = true;
  if (options.skipPremiumRefresh) {
    options.pendingSkipPremiumRefreshRef.current = true;
  }
}

export function clearPendingLeave(leave: PolicyLeaveApi | null): void {
  if (!leave?.pendingLeaveAfterSaveRef.current) return;
  leave.pendingLeaveAfterSaveRef.current = false;
  leave.setPendingLeaveAfterSave(false);
}

export function applyOptimisticDraftSave(options: {
  refs: DraftPersistRefs;
  setters: DraftPersistSetters;
  form: UseFormReturn<CarPolicyFormValues>;
  payload: string;
  pathsToValidate: string[];
}): number {
  const { refs, setters } = options;
  const epoch = refs.saveEpochTracker.current.increment();
  refs.previousSnapshotRef.current = refs.savedSnapshotRef.current;
  refs.previousSavedAtRef.current = refs.lastHandledSavedAtRef.current;

  refs.savedSnapshotRef.current = options.payload;
  refs.hasUnsavedChangesRef.current = false;
  setters.setHasUnsavedChanges(false);
  setters.setDraftSaveError(null);
  setters.setDraftSavedAt(new Date().toISOString());
  setters.commitSavedPaths(refs.pendingDirtyPathsRef.current);
  setters.publishSaveStatus("saved");
  validateSavedPaths(options.form, options.pathsToValidate);

  refs.isSavingDraftRef.current = true;
  refs.pendingSaveAfterCurrentRef.current = false;
  return epoch;
}

export function rollbackDraftSave(options: {
  refs: DraftPersistRefs;
  setters: DraftPersistSetters;
  leave: PolicyLeaveApi | null;
  formError: string;
  form?: UseFormReturn<CarPolicyFormValues>;
  policyNumberError?: string;
}): void {
  const { refs, setters } = options;
  refs.savedSnapshotRef.current = refs.previousSnapshotRef.current;
  setters.setDraftSavedAt(refs.previousSavedAtRef.current);
  refs.hasUnsavedChangesRef.current = true;
  setters.setHasUnsavedChanges(true);
  setters.rollbackSavedPaths(refs.pendingDirtyPathsRef.current);
  if (options.policyNumberError && options.form) {
    options.form.setError("policyNumber", {
      type: "server",
      message: options.policyNumberError,
    });
  }
  setters.setDraftSaveError(options.formError);
  setters.publishSaveStatus("error");
  clearPendingLeave(options.leave);
}

export function reconcileDraftSaveSuccess(options: {
  refs: DraftPersistRefs;
  setters: DraftPersistSetters;
  form: UseFormReturn<CarPolicyFormValues>;
  draftSnapshot: () => string;
  skipPremiumRefresh: boolean;
  policyNumber: string | undefined;
  savedAt: string;
  payload: string;
}): boolean {
  const { refs, setters } = options;
  options.form.clearErrors("policyNumber");
  refs.lastHandledSavedAtRef.current = options.savedAt;
  setters.setDraftSavedAt(options.savedAt);
  setters.setDraftSaveError(null);

  const currentPayload = options.draftSnapshot();
  const editedDuringSave =
    !refs.pendingDraftPayloadRef.current ||
    refs.pendingDraftPayloadRef.current !== currentPayload;

  if (editedDuringSave) {
    refs.savedSnapshotRef.current =
      refs.pendingDraftPayloadRef.current ?? options.payload;
    refs.hasUnsavedChangesRef.current = true;
    setters.setHasUnsavedChanges(true);
    refs.pendingSaveAfterCurrentRef.current = true;
  } else {
    refs.savedSnapshotRef.current = currentPayload;
    refs.hasUnsavedChangesRef.current = false;
    setters.setHasUnsavedChanges(false);
    setters.publishSaveStatus("saved");
  }

  if (!options.skipPremiumRefresh && !refs.premiumManuallyEditedRef.current) {
    setters.refreshPremiumAfterSave(refs.pendingDirtyPathsRef.current);
  }
  toastPolicyDraftSaved(
    options.policyNumber,
    refs.pendingDirtyPathsRef.current,
  );
  return editedDuringSave;
}

export function completeLeaveAfterDraftSave(options: {
  leave: PolicyLeaveApi | null;
  editedDuringSave: boolean;
  clientId: string;
  navigate: NavigateFunction;
}): void {
  const { leave } = options;
  if (!leave?.pendingLeaveAfterSaveRef.current || options.editedDuringSave) {
    return;
  }
  leave.pendingLeaveAfterSaveRef.current = false;
  leave.setPendingLeaveAfterSave(false);
  leave.setDiscardConfirmOpen(false);
  leave.allowLeaveRef.current = true;
  const destination =
    leave.pendingLeaveDestinationRef.current ?? `/clients/${options.clientId}`;
  leave.pendingLeaveDestinationRef.current = null;
  if (leave.blocker.state === "blocked") {
    leave.blocker.proceed();
  } else {
    options.navigate(destination);
  }
}

export function queueFollowUpDraftSave(options: {
  epoch: number;
  refs: DraftPersistRefs;
  persistDraft: (opts: {
    force: boolean;
    skipPremiumRefresh: boolean;
  }) => Promise<boolean>;
}): void {
  const { refs } = options;
  refs.isSavingDraftRef.current = false;
  if (!refs.saveEpochTracker.current.isCurrent(options.epoch)) return;
  if (!refs.pendingSaveAfterCurrentRef.current) return;
  refs.pendingSaveAfterCurrentRef.current = false;
  const skipPremiumRefresh = refs.pendingSkipPremiumRefreshRef.current;
  refs.pendingSkipPremiumRefreshRef.current = false;
  queueMicrotask(() => {
    void options.persistDraft({ force: true, skipPremiumRefresh });
  });
}

/** Drop queued follow-up saves so a later recalculate is not overwritten. */
export function discardInFlightDraft(refs: DraftPersistRefs): void {
  refs.saveEpochTracker.current.increment();
  refs.pendingSaveAfterCurrentRef.current = false;
  refs.pendingSkipPremiumRefreshRef.current = false;
}

/** Wait until the current draft HTTP request finishes (or the timeout). */
export async function waitWhileDraftSaving(
  isSavingDraftRef: RefBox<boolean>,
  timeoutMs = 8_000,
  pollMs = 40,
): Promise<void> {
  const started = Date.now();
  while (isSavingDraftRef.current && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

export function rollbackFromSaveResult(options: {
  refs: DraftPersistRefs;
  setters: DraftPersistSetters;
  leave: PolicyLeaveApi | null;
  form: UseFormReturn<CarPolicyFormValues>;
  data: Extract<DraftSaveResult, { ok: false }>;
}): void {
  rollbackDraftSave({
    refs: options.refs,
    setters: options.setters,
    leave: options.leave,
    form: options.form,
    formError:
      options.data.formError ??
      "Draft could not be saved. Check the form and try again.",
    policyNumberError: options.data.errors?.policyNumber?.[0],
  });
}

export function beginDraftSave(options: {
  refs: DraftPersistRefs;
  setters: DraftPersistSetters;
  form: UseFormReturn<CarPolicyFormValues>;
  getDirtyPaths: () => string[];
  draftSnapshot: () => string;
}): { epoch: number; payload: string } {
  options.refs.pendingDirtyPathsRef.current = collectDraftDirtyPaths(
    options.getDirtyPaths(),
    options.form.formState.dirtyFields,
  );
  const payload = options.draftSnapshot();
  options.refs.pendingDraftPayloadRef.current = payload;
  const epoch = applyOptimisticDraftSave({
    refs: options.refs,
    setters: options.setters,
    form: options.form,
    payload,
    pathsToValidate: [...options.refs.pendingDirtyPathsRef.current],
  });
  return { epoch, payload };
}

export async function finishDraftSaveAttempt(options: {
  epoch: number;
  refs: DraftPersistRefs;
  setters: DraftPersistSetters;
  leave: PolicyLeaveApi | null;
  form: UseFormReturn<CarPolicyFormValues>;
  draftSnapshot: () => string;
  skipPremiumRefresh: boolean;
  policyNumber: string | undefined;
  payload: string;
  clientId: string;
  navigate: NavigateFunction;
  policyId: string;
  premium: PremiumBreakdown | undefined;
  premiumManualKeys: string[];
}): Promise<boolean> {
  try {
    const data = await savePolicyDraftClient(
      options.policyId,
      buildDraftSaveValues(
        options.form,
        options.premium,
        options.premiumManualKeys,
      ),
    );
    if (!options.refs.saveEpochTracker.current.isCurrent(options.epoch)) {
      return false;
    }
    if (!data.ok) {
      rollbackFromSaveResult({ ...options, data });
      return false;
    }
    const editedDuringSave = reconcileDraftSaveSuccess({
      refs: options.refs,
      setters: options.setters,
      form: options.form,
      draftSnapshot: options.draftSnapshot,
      skipPremiumRefresh: options.skipPremiumRefresh,
      policyNumber: options.policyNumber,
      savedAt: data.savedAt,
      payload: options.payload,
    });
    completeLeaveAfterDraftSave({
      leave: options.leave,
      editedDuringSave,
      clientId: options.clientId,
      navigate: options.navigate,
    });
    return true;
  } catch {
    if (!options.refs.saveEpochTracker.current.isCurrent(options.epoch)) {
      return false;
    }
    rollbackDraftSave({
      refs: options.refs,
      setters: options.setters,
      leave: options.leave,
      formError: "Draft could not be saved. Check your connection.",
    });
    return false;
  }
}
