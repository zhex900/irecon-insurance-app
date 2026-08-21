import { type RefObject, useEffect } from "react";
import { type useFetcher, useNavigate } from "react-router";

import type { Policy } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import type { PolicyLeaveApi } from "../draft/use-draft-types";
import { useLeaveActions } from "../leave/use-leave-actions";
import { useLeaveState } from "../leave/use-leave-state";
import type { PolicyWizardActionData } from "./use-premium-calc";

export function usePolicyLeaveGuard({
  policy,
  hasUnsavedChanges,
  hasUnsavedChangesRef,
  setHasUnsavedChanges,
  saveDraftNow,
  savePolicy,
  setDraftSaveError,
  fetcher,
  leaveApiRef,
}: {
  policy: Policy;
  hasUnsavedChanges: boolean;
  hasUnsavedChangesRef: RefObject<boolean>;
  setHasUnsavedChanges: (value: boolean) => void;
  saveDraftNow: () => Promise<boolean | void>;
  savePolicy: (overrides?: Partial<CarPolicyFormValues>) => Promise<boolean>;
  setDraftSaveError: (error: string | null) => void;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  leaveApiRef: RefObject<PolicyLeaveApi | null>;
}): PolicyLeaveApi & {
  pendingLeaveAfterSave: boolean;
  discardConfirmOpen: boolean;
  setDiscardConfirmOpen: (open: boolean) => void;
  discarding: boolean;
  leaveDialogOpen: boolean;
  discardNewPolicy: () => Promise<void>;
  leaveWithoutSaving: () => void;
  saveAndLeave: () => Promise<void>;
  stayOnPage: () => void;
  handleCancelClick: () => void;
} {
  const navigate = useNavigate();
  const state = useLeaveState({
    policy,
    hasUnsavedChanges,
    hasUnsavedChangesRef,
    setHasUnsavedChanges,
    fetcher,
  });
  const actions = useLeaveActions({
    policy,
    navigate,
    blocker: state.blocker,
    allowLeaveRef: state.allowLeaveRef,
    pendingLeaveAfterSaveRef: state.pendingLeaveAfterSaveRef,
    pendingLeaveDestinationRef: state.pendingLeaveDestinationRef,
    setPendingLeaveAfterSave: state.setPendingLeaveAfterSave,
    setDiscardConfirmOpen: state.setDiscardConfirmOpen,
    setDiscarding: state.setDiscarding,
    setDraftSaveError,
    saveDraftNow,
    savePolicy,
    isSavedTerminal: state.isSavedTerminal,
    isNew: state.isNew,
    isFormTerminal: state.isFormTerminal,
  });

  const leaveDialogOpen =
    state.blocker.state === "blocked" ||
    (state.isNew && state.discardConfirmOpen) ||
    state.pendingLeaveAfterSave ||
    state.discarding;

  useEffect(() => {
    leaveApiRef.current = {
      blocker: state.blocker,
      allowLeaveRef: state.allowLeaveRef,
      pendingLeaveAfterSaveRef: state.pendingLeaveAfterSaveRef,
      pendingLeaveDestinationRef: state.pendingLeaveDestinationRef,
      setPendingLeaveAfterSave: state.setPendingLeaveAfterSave,
      setDiscardConfirmOpen: state.setDiscardConfirmOpen,
    };
  }, [
    leaveApiRef,
    state.blocker,
    state.allowLeaveRef,
    state.pendingLeaveAfterSaveRef,
    state.pendingLeaveDestinationRef,
    state.setPendingLeaveAfterSave,
    state.setDiscardConfirmOpen,
  ]);

  return {
    blocker: state.blocker,
    allowLeaveRef: state.allowLeaveRef,
    pendingLeaveAfterSaveRef: state.pendingLeaveAfterSaveRef,
    pendingLeaveDestinationRef: state.pendingLeaveDestinationRef,
    pendingLeaveAfterSave: state.pendingLeaveAfterSave,
    setPendingLeaveAfterSave: state.setPendingLeaveAfterSave,
    discardConfirmOpen: state.discardConfirmOpen,
    setDiscardConfirmOpen: state.setDiscardConfirmOpen,
    discarding: state.discarding,
    leaveDialogOpen,
    ...actions,
  };
}
