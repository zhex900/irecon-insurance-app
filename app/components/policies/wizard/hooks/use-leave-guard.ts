import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useBlocker, useNavigate, type useFetcher } from "react-router";
import type { Policy } from "~/lib/db/types";
import { discardPolicyDraftClient } from "~/lib/services/policy/draft.client";
import { clearWizardStepState, consumeWizardLeave } from "../step-memory";
import type { PolicyLeaveApi } from "./use-draft-save";
import type { PolicyWizardActionData } from "./use-premium-calc";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

export function usePolicyLeaveGuard({
  policy,
  readOnly,
  isNew,
  isFormTerminal,
  hasUnsavedChanges,
  hasUnsavedChangesRef,
  setHasUnsavedChanges,
  saveDraftNow,
  savePolicy,
  setDraftSaveError,
  fetcher,
}: {
  policy: Policy;
  readOnly: boolean;
  isNew: boolean;
  isFormTerminal: boolean;
  hasUnsavedChanges: boolean;
  hasUnsavedChangesRef: MutableRefObject<boolean>;
  setHasUnsavedChanges: (value: boolean) => void;
  saveDraftNow: () => Promise<boolean | void>;
  savePolicy: (overrides?: Partial<CarPolicyFormValues>) => Promise<boolean>;
  setDraftSaveError: (error: string | null) => void;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
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
  const [pendingLeaveAfterSave, setPendingLeaveAfterSave] = useState(false);
  const pendingLeaveAfterSaveRef = useRef(false);
  useEffect(() => {
    pendingLeaveAfterSaveRef.current = pendingLeaveAfterSave;
  });
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const allowLeaveRef = useRef(false);

  // New policies: always confirm before leaving (avoids orphan drafts).
  // Existing policies: only block when there are unsaved edits.
  const blocker = useBlocker(() => {
    if (readOnly || allowLeaveRef.current) return false;
    if (consumeWizardLeave(policy.policyId)) {
      allowLeaveRef.current = true;
      return false;
    }
    if (isNew) return true;
    return hasUnsavedChangesRef.current;
  });

  // Full save failed after we cleared dirty state — restore so the user can retry.
  const failureHandledRef = useRef<PolicyWizardActionData | undefined>(
    undefined,
  );
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (failureHandledRef.current === fetcher.data) return;
    failureHandledRef.current = fetcher.data;
    const failed =
      Boolean(fetcher.data.formError) || Boolean(fetcher.data.errors);
    if (!failed || !allowLeaveRef.current) return;
    allowLeaveRef.current = false;
    hasUnsavedChangesRef.current = true;
    setHasUnsavedChanges(true);
    if (pendingLeaveAfterSaveRef.current) setPendingLeaveAfterSave(false);
  }, [fetcher.state, fetcher.data, hasUnsavedChangesRef, setHasUnsavedChanges]);

  // If unsaved clears while blocked: stay on new policies so discard can run;
  // existing policies with a clean form can dismiss the block. Never proceed
  // solely because a leave-save is in flight — wait for allowLeaveRef after success.
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (allowLeaveRef.current) {
      setPendingLeaveAfterSave(false);
      blocker.proceed();
      return;
    }
    if (!isNew && !hasUnsavedChanges) {
      blocker.reset();
    }
  }, [blocker, hasUnsavedChanges, isNew]);

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
        if (blocker.state === "blocked") blocker.reset();
        return;
      }
      clearWizardStepState(policy.policyId);
      allowLeaveRef.current = true;
      setDiscardConfirmOpen(false);
      if (blocker.state === "blocked") {
        blocker.proceed();
      } else {
        navigate(`/clients/${policy.clientId}`);
      }
    } catch {
      setDraftSaveError(
        "Could not discard this policy. Check your connection.",
      );
      setDiscardConfirmOpen(false);
      if (blocker.state === "blocked") blocker.reset();
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
    if (blocker.state === "blocked") {
      blocker.proceed();
    }
  }

  async function saveAndLeave() {
    pendingLeaveAfterSaveRef.current = true;
    setPendingLeaveAfterSave(true);
    try {
      if (isFormTerminal) {
        const ok = await savePolicy();
        if (!ok) {
          pendingLeaveAfterSaveRef.current = false;
          setPendingLeaveAfterSave(false);
        }
        return;
      }
      // Await the draft save. Leave navigation runs inside persistDraft on
      // success; do not clear pending here if a follow-up save was queued.
      await saveDraftNow();
      if (!pendingLeaveAfterSaveRef.current) {
        setPendingLeaveAfterSave(false);
      }
    } catch {
      pendingLeaveAfterSaveRef.current = false;
      setPendingLeaveAfterSave(false);
    }
  }

  function stayOnPage() {
    pendingLeaveAfterSaveRef.current = false;
    setPendingLeaveAfterSave(false);
    setDiscardConfirmOpen(false);
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  }

  function handleCancelClick() {
    if (readOnly) {
      navigate(`/clients/${policy.clientId}`);
      return;
    }
    if (isNew) {
      setDiscardConfirmOpen(true);
      return;
    }
    navigate(`/clients/${policy.clientId}`);
  }

  const leaveDialogOpen =
    blocker.state === "blocked" ||
    (isNew && discardConfirmOpen) ||
    pendingLeaveAfterSave ||
    discarding;

  return {
    blocker,
    allowLeaveRef,
    pendingLeaveAfterSaveRef,
    pendingLeaveAfterSave,
    setPendingLeaveAfterSave,
    discardConfirmOpen,
    setDiscardConfirmOpen,
    discarding,
    leaveDialogOpen,
    discardNewPolicy,
    leaveWithoutSaving,
    saveAndLeave,
    stayOnPage,
    handleCancelClick,
  };
}
