import type { RefObject } from "react";
import type { Blocker, NavigateFunction } from "react-router";

import type { Policy } from "~/lib/db/types";
import { discardPolicyDraftClient } from "~/lib/services/policy/draft.client";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import { clearWizardStepState } from "../../wizard-step-memory";
import { proceedOrNavigate, resetBlockerIfNeeded } from "./leave-helpers";

export function useLeaveActions(options: {
  policy: Policy;
  navigate: NavigateFunction;
  blocker: Blocker;
  allowLeaveRef: RefObject<boolean>;
  pendingLeaveAfterSaveRef: RefObject<boolean>;
  pendingLeaveDestinationRef: RefObject<string | null>;
  setPendingLeaveAfterSave: (value: boolean) => void;
  setDiscardConfirmOpen: (open: boolean) => void;
  setDiscarding: (value: boolean) => void;
  setDraftSaveError: (error: string | null) => void;
  saveDraftNow: () => Promise<boolean | void>;
  savePolicy: (overrides?: Partial<CarPolicyFormValues>) => Promise<boolean>;
  readOnly: boolean;
  isNew: boolean;
  isFormTerminal: boolean;
}) {
  const {
    policy,
    navigate,
    blocker,
    allowLeaveRef,
    pendingLeaveAfterSaveRef,
    pendingLeaveDestinationRef,
    setPendingLeaveAfterSave,
    setDiscardConfirmOpen,
    setDiscarding,
    setDraftSaveError,
    saveDraftNow,
    savePolicy,
    readOnly,
    isNew,
    isFormTerminal,
  } = options;
  const clientPath = `/clients/${policy.clientId}`;

  async function discardNewPolicy() {
    setDiscarding(true);
    setDraftSaveError(null);
    try {
      const result = await discardPolicyDraftClient(policy.policyId);
      if (!result.ok) {
        setDraftSaveError(
          result.formError ?? "Could not discard this policy. Try again.",
        );
        setDiscardConfirmOpen(false);
        resetBlockerIfNeeded(blocker);
        return;
      }
      clearWizardStepState(policy.policyId);
      allowLeaveRef.current = true;
      setDiscardConfirmOpen(false);
      proceedOrNavigate({ blocker, navigate, destination: clientPath });
    } catch {
      setDraftSaveError(
        "Could not discard this policy. Check your connection.",
      );
      setDiscardConfirmOpen(false);
      resetBlockerIfNeeded(blocker);
    } finally {
      setDiscarding(false);
    }
  }

  function leaveWithoutSaving() {
    if (isNew) {
      void discardNewPolicy();
      return;
    }
    allowLeaveRef.current = true;
    pendingLeaveAfterSaveRef.current = false;
    setPendingLeaveAfterSave(false);
    if (blocker.state === "blocked") blocker.proceed();
  }

  async function saveAndLeaveForTerminalStatus() {
    const ok = await savePolicy();
    if (!ok) return false;
    setDiscardConfirmOpen(false);
    proceedOrNavigate({
      blocker,
      navigate,
      destination: pendingLeaveDestinationRef.current ?? clientPath,
    });
    pendingLeaveDestinationRef.current = null;
    return true;
  }

  async function saveAndLeave() {
    pendingLeaveAfterSaveRef.current = true;
    setPendingLeaveAfterSave(true);
    try {
      if (isFormTerminal) {
        const success = await saveAndLeaveForTerminalStatus();
        if (!success) {
          pendingLeaveAfterSaveRef.current = false;
          setPendingLeaveAfterSave(false);
        }
        return;
      }
      await saveDraftNow();
      if (!pendingLeaveAfterSaveRef.current) setPendingLeaveAfterSave(false);
    } catch {
      pendingLeaveAfterSaveRef.current = false;
      setPendingLeaveAfterSave(false);
    }
  }

  function stayOnPage() {
    pendingLeaveAfterSaveRef.current = false;
    setPendingLeaveAfterSave(false);
    setDiscardConfirmOpen(false);
    resetBlockerIfNeeded(blocker);
  }

  function handleCancelClick() {
    if (readOnly || !isNew) {
      navigate(clientPath);
      return;
    }
    setDiscardConfirmOpen(true);
  }

  return {
    discardNewPolicy,
    leaveWithoutSaving,
    saveAndLeave,
    stayOnPage,
    handleCancelClick,
  };
}
