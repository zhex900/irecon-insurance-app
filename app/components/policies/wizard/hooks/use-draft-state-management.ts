import { useCallback, useEffect, useRef, useState } from "react";
import { useMode } from "./use-mode";
import type { PolicySaveStatus } from "~/components/forms/field-save-highlight";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import type { PremiumBreakdown } from "~/lib/db/types";
import { SaveEpochTracker } from "./use-draft-save-utils";
import type { UseFormReturn } from "react-hook-form";

export function useDraftStateManagement({
  form: _form,
  premiumRef: _premiumRef,
  premiumManualKeysRef: _premiumManualKeysRef,
}: {
  form: UseFormReturn<CarPolicyFormValues>;
  premiumRef: React.RefObject<PremiumBreakdown | undefined>;
  premiumManualKeysRef: React.RefObject<string[]>;
}) {
  const { fieldsLocked } = useMode();

  // State
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<PolicySaveStatus>("idle");

  // Refs
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const isSavingDraftRef = useRef(false);
  const pendingSaveAfterCurrentRef = useRef(false);
  const pendingSkipPremiumRefreshRef = useRef(false);
  const lastHandledSavedAtRef = useRef<string | null>(null);
  const pendingDraftPayloadRef = useRef<string | null>(null);
  const pendingDirtyPathsRef = useRef<string[]>([]);
  const lastStatusRef = useRef<PolicySaveStatus | null>(null);
  const saveEpochTracker = useRef(new SaveEpochTracker());

  // Snapshot refs
  const savedSnapshotRef = useRef("");
  const previousSnapshotRef = useRef("");
  const previousSavedAtRef = useRef<string | null>(null);

  // Sync refs with state
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Save status management
  const publishSaveStatus = useCallback(
    (status: PolicySaveStatus) => {
      if (fieldsLocked) return;
      if (lastStatusRef.current === status) return;
      lastStatusRef.current = status;
      setSaveStatus(status);
    },
    [fieldsLocked],
  );

  // Update save status based on state changes
  useEffect(() => {
    if (fieldsLocked) return;
    if (draftSaveError) {
      publishSaveStatus("error");
      return;
    }
    if (hasUnsavedChanges) {
      publishSaveStatus("unsaved");
      return;
    }
    if (draftSavedAt) {
      publishSaveStatus("saved");
      return;
    }
    publishSaveStatus("idle");
  }, [
    draftSaveError,
    draftSavedAt,
    hasUnsavedChanges,
    fieldsLocked,
    publishSaveStatus,
  ]);

  return {
    // State
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

    // Refs
    hasUnsavedChangesRef,
    isSavingDraftRef,
    pendingSaveAfterCurrentRef,
    pendingSkipPremiumRefreshRef,
    lastHandledSavedAtRef,
    pendingDraftPayloadRef,
    pendingDirtyPathsRef,
    lastStatusRef,
    saveEpochTracker,

    // Snapshot refs
    savedSnapshotRef,
    previousSnapshotRef,
    previousSavedAtRef,

    // Utilities
    fieldsLocked,
  };
}
