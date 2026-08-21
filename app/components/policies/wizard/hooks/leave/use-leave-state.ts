import { type RefObject, useEffect, useRef, useState } from "react";
import { useBlocker, type useFetcher } from "react-router";

import type { Policy } from "~/lib/db/types";

import { consumeWizardLeave } from "../../wizard-step-memory";
import type { PolicyWizardActionData } from "../composite/use-premium-calc";
import { usePolicyPhase } from "../utils/use-mode";
import { destinationFromBlocker } from "./leave-helpers";

export function useLeaveFetcherFailure(options: {
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  allowLeaveRef: RefObject<boolean>;
  hasUnsavedChangesRef: RefObject<boolean>;
  pendingLeaveAfterSaveRef: RefObject<boolean>;
  setHasUnsavedChanges: (value: boolean) => void;
  setPendingLeaveAfterSave: (value: boolean) => void;
}): void {
  const failureHandledRef = useRef<PolicyWizardActionData | undefined>(
    undefined,
  );
  const {
    fetcher,
    allowLeaveRef,
    hasUnsavedChangesRef,
    pendingLeaveAfterSaveRef,
    setHasUnsavedChanges,
    setPendingLeaveAfterSave,
  } = options;

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
  }, [
    fetcher.state,
    fetcher.data,
    allowLeaveRef,
    hasUnsavedChangesRef,
    pendingLeaveAfterSaveRef,
    setHasUnsavedChanges,
    setPendingLeaveAfterSave,
  ]);
}

export function useLeaveBlockerEffects(options: {
  blocker: ReturnType<typeof useBlocker>;
  allowLeaveRef: RefObject<boolean>;
  pendingLeaveAfterSaveRef: RefObject<boolean>;
  pendingLeaveDestinationRef: RefObject<string | null>;
  setPendingLeaveAfterSave: (value: boolean) => void;
  hasUnsavedChanges: boolean;
  isNew: boolean;
}): void {
  const {
    blocker,
    allowLeaveRef,
    pendingLeaveAfterSaveRef,
    pendingLeaveDestinationRef,
    setPendingLeaveAfterSave,
    hasUnsavedChanges,
    isNew,
  } = options;

  useEffect(() => {
    const destination = destinationFromBlocker(blocker);
    if (destination) pendingLeaveDestinationRef.current = destination;
    if (blocker.state !== "blocked") return;
    if (allowLeaveRef.current) {
      setPendingLeaveAfterSave(false);
      blocker.proceed();
      return;
    }
    if (pendingLeaveAfterSaveRef.current) return;
    if (!isNew && !hasUnsavedChanges) {
      blocker.reset();
    }
  }, [
    blocker,
    hasUnsavedChanges,
    isNew,
    allowLeaveRef,
    pendingLeaveAfterSaveRef,
    pendingLeaveDestinationRef,
    setPendingLeaveAfterSave,
  ]);
}

export function useLeaveState(options: {
  policy: Policy;
  hasUnsavedChanges: boolean;
  hasUnsavedChangesRef: RefObject<boolean>;
  setHasUnsavedChanges: (value: boolean) => void;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
}) {
  const {
    policy,
    hasUnsavedChanges,
    hasUnsavedChangesRef,
    setHasUnsavedChanges,
    fetcher,
  } = options;
  const [pendingLeaveAfterSave, setPendingLeaveAfterSave] = useState(false);
  const pendingLeaveAfterSaveRef = useRef(false);
  useEffect(() => {
    pendingLeaveAfterSaveRef.current = pendingLeaveAfterSave;
  });
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const allowLeaveRef = useRef(false);
  const pendingLeaveDestinationRef = useRef<string | null>(null);
  const { isSavedTerminal, isNew, isFormTerminal } = usePolicyPhase();

  const blocker = useBlocker(() => {
    if (isSavedTerminal || allowLeaveRef.current) return false;
    if (consumeWizardLeave(policy.policyId)) {
      allowLeaveRef.current = true;
      return false;
    }
    if (isNew) return true;
    return hasUnsavedChangesRef.current;
  });

  useLeaveFetcherFailure({
    fetcher,
    allowLeaveRef,
    hasUnsavedChangesRef,
    pendingLeaveAfterSaveRef,
    setHasUnsavedChanges,
    setPendingLeaveAfterSave,
  });
  useLeaveBlockerEffects({
    blocker,
    allowLeaveRef,
    pendingLeaveAfterSaveRef,
    pendingLeaveDestinationRef,
    setPendingLeaveAfterSave,
    hasUnsavedChanges,
    isNew,
  });

  return {
    blocker,
    allowLeaveRef,
    pendingLeaveAfterSave,
    pendingLeaveAfterSaveRef,
    pendingLeaveDestinationRef,
    setPendingLeaveAfterSave,
    discardConfirmOpen,
    setDiscardConfirmOpen,
    discarding,
    setDiscarding,
    isSavedTerminal,
    isNew,
    isFormTerminal,
  };
}
