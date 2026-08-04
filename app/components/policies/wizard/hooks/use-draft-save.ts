import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { NavigateFunction, Blocker } from "react-router";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import {
  flattenDirtyPaths,
  type PolicySaveStatus,
} from "~/components/forms/field-save-highlight";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { labelForPolicyFieldPath } from "~/lib/policy-field-labels";
import { savePolicyDraftClient } from "~/lib/services/policy/draft.client";
import { pricingFields, type CarPolicyFormValues } from "~/lib/zod/policy-car";

export type PolicyLeaveApi = {
  blocker: Blocker;
  allowLeaveRef: MutableRefObject<boolean>;
  pendingLeaveAfterSaveRef: MutableRefObject<boolean>;
  setPendingLeaveAfterSave: (value: boolean) => void;
  setDiscardConfirmOpen: (value: boolean) => void;
};

function toastPolicyDraftSaved(
  policyNumber: string | undefined,
  paths: string[],
) {
  const policy = policyNumber?.trim() || "Policy";
  const labels = [
    ...new Set(paths.map((path) => labelForPolicyFieldPath(path))),
  ];
  if (labels.length === 0) {
    toast.success(`${policy} saved`);
    return;
  }
  if (labels.length <= 3) {
    toast.success(`${policy} saved · ${labels.join(", ")}`);
    return;
  }
  toast.success(
    `${policy} saved · ${labels.slice(0, 3).join(", ")} +${labels.length - 3} more`,
  );
}

export function usePolicyDraftSave({
  policy,
  form,
  fieldsLocked,
  premiumRef,
  premiumManuallyEditedRef,
  getDirtyPaths,
  commitSavedPaths,
  rollbackSavedPaths,
  refreshPremiumAfterSave,
  getLeaveApi,
  navigate,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  fieldsLocked: boolean;
  premiumRef: MutableRefObject<PremiumBreakdown | undefined>;
  premiumManuallyEditedRef: MutableRefObject<boolean>;
  getDirtyPaths: () => string[];
  commitSavedPaths: (paths: string[]) => void;
  rollbackSavedPaths: (paths: string[]) => void;
  refreshPremiumAfterSave: (dirtyPaths: string[]) => void;
  getLeaveApi: () => PolicyLeaveApi | null;
  navigate: NavigateFunction;
}) {
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  /** Local unsaved flag — avoids form.reset() which remounts every field. */
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<PolicySaveStatus>("idle");

  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  });
  const isSavingDraftRef = useRef(false);
  /** When a save is in flight, queue another pass so blur/Save edits are not dropped. */
  const pendingSaveAfterCurrentRef = useRef(false);
  /** Preserve skipPremiumRefresh across a queued follow-up save. */
  const pendingSkipPremiumRefreshRef = useRef(false);
  const lastHandledSavedAtRef = useRef<string | null>(null);
  const pendingDraftPayloadRef = useRef<string | null>(null);
  const pendingDirtyPathsRef = useRef<string[]>([]);
  const lastStatusRef = useRef<PolicySaveStatus | null>(null);
  const saveEpochRef = useRef(0);

  const draftSnapshot = useCallback(
    (values: CarPolicyFormValues = form.getValues()) => {
      return JSON.stringify({
        ...values,
        ...(premiumRef.current ? { premium: premiumRef.current } : {}),
      });
    },
    [form, premiumRef],
  );
  const savedSnapshotRef = useRef("");
  const previousSnapshotRef = useRef("");
  const previousSavedAtRef = useRef<string | null>(null);

  // Seed the saved snapshot once on mount (reads live refs, so this can't run during render).
  useEffect(() => {
    const initial = draftSnapshot();
    savedSnapshotRef.current = initial;
    previousSnapshotRef.current = initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-time snapshot seed on mount
  }, []);

  // Keep local unsaved flag in sync with edits (no reliance on RHF isDirty/reset).
  // Re-validate fields that already show errors as the user updates them.
  useEffect(() => {
    const pricingRoots = new Set<string>(pricingFields);
    const subscription = form.watch((values, info) => {
      const name = info.name;
      const root = name?.split(".")[0] ?? "";
      // Only real value edits clear the manual-premium guard. Validation /
      // trigger callbacks must not — otherwise a premium-breakdown save can
      // race into a server recalculate that wipes ES/DH-folded terrorism.
      if (root && pricingRoots.has(root) && info.type === "change") {
        premiumManuallyEditedRef.current = false;
      }
      if (name) {
        const { error } = form.getFieldState(
          name as FieldPath<CarPolicyFormValues>,
        );
        if (error) {
          void form.trigger(name as FieldPath<CarPolicyFormValues>);
        }
      }
      const snapshot = draftSnapshot(values as CarPolicyFormValues);
      const dirty = snapshot !== savedSnapshotRef.current;
      setHasUnsavedChanges((prev) => (prev === dirty ? prev : dirty));
    });
    return () => subscription.unsubscribe();
  }, [form, draftSnapshot, premiumManuallyEditedRef]);

  function publishSaveStatus(status: PolicySaveStatus) {
    if (fieldsLocked) return;
    if (lastStatusRef.current === status) return;
    lastStatusRef.current = status;
    setSaveStatus(status);
  }

  /** Validate fields that were just draft-saved (full schema, progressive feedback). */
  function validateSavedPaths(paths: string[]) {
    const unique = [
      ...new Set(paths.filter((path) => path.length > 0)),
    ] as FieldPath<CarPolicyFormValues>[];
    if (unique.length === 0) return;
    void form.trigger(unique);
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSaveError, draftSavedAt, hasUnsavedChanges, fieldsLocked]);

  async function persistDraft({
    force = false,
    skipPremiumRefresh = false,
  }: {
    force?: boolean;
    /** Set when saving after Premium Breakdown click-to-edit (client already recalced). */
    skipPremiumRefresh?: boolean;
  } = {}) {
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
    };
    const payload = draftSnapshot();
    pendingDraftPayloadRef.current = payload;

    // --- Optimistic UI (in-place, no "Saving…" flicker) ---
    const epoch = ++saveEpochRef.current;
    previousSnapshotRef.current = savedSnapshotRef.current;
    previousSavedAtRef.current = draftSavedAt;
    const optimisticSavedAt = new Date().toISOString();

    savedSnapshotRef.current = payload;
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    setDraftSaveError(null);
    setDraftSavedAt(optimisticSavedAt);
    commitSavedPaths(pendingDirtyPathsRef.current);
    publishSaveStatus("saved");
    validateSavedPaths(pathsToValidate);

    isSavingDraftRef.current = true;
    pendingSaveAfterCurrentRef.current = false;

    try {
      const data = await savePolicyDraftClient(policy.policyId, values);

      // A newer save started — ignore this response for UI.
      if (epoch !== saveEpochRef.current) return false;

      if (!data.ok) {
        // Roll back optimistic UI
        savedSnapshotRef.current = previousSnapshotRef.current;
        setDraftSavedAt(previousSavedAtRef.current);
        hasUnsavedChangesRef.current = true;
        setHasUnsavedChanges(true);
        rollbackSavedPaths(pendingDirtyPathsRef.current);
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
      toastPolicyDraftSaved(policy.policyNumber, pendingDirtyPathsRef.current);

      if (leave?.pendingLeaveAfterSaveRef.current && !editedDuringSave) {
        leave.pendingLeaveAfterSaveRef.current = false;
        leave.setPendingLeaveAfterSave(false);
        leave.setDiscardConfirmOpen(false);
        leave.allowLeaveRef.current = true;
        if (leave.blocker.state === "blocked") {
          leave.blocker.proceed();
        } else {
          navigate(`/clients/${policy.clientId}`);
        }
      }
      return true;
    } catch {
      if (epoch !== saveEpochRef.current) return false;
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
      if (epoch === saveEpochRef.current) {
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
  }

  function submitDraft() {
    void persistDraft();
  }

  function saveDraftNow() {
    void (async () => {
      setManualSaving(true);
      try {
        await persistDraft({ force: true });
      } finally {
        setManualSaving(false);
      }
    })();
  }

  /** Save draft when a field loses focus after edits. */
  function handleFieldBlur() {
    if (fieldsLocked) return;
    if (!hasUnsavedChangesRef.current) return;
    submitDraft();
  }

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
