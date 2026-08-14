import { useEffect, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import {
  flattenDirtyPaths,
  type PolicySaveStatus,
} from "~/components/forms/field-save-highlight";
import {
  discardClientDraftClient,
  saveClientDraftClient,
} from "~/lib/services/clients/draft.client";
import type { Client } from "~/lib/db/types";
import { flattenFieldErrors, focusFormIssue } from "~/lib/form-validation-ui";
import type { ClientFormValues } from "~/lib/zod/client";

export function useFormDraft({
  client,
  form,
  isNew,
  cancelTo,
  getDirtyPaths,
  commitSavedPaths,
  rollbackSavedPaths,
}: {
  client: Client;
  form: UseFormReturn<ClientFormValues>;
  isNew: boolean;
  cancelTo: string;
  getDirtyPaths: () => string[];
  commitSavedPaths: (paths: string[]) => void;
  rollbackSavedPaths: (paths: string[]) => void;
}) {
  const navigate = useNavigate();

  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<PolicySaveStatus>("idle");
  const [pendingLeaveAfterSave, setPendingLeaveAfterSave] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  });

  const isSavingDraftRef = useRef(false);
  const lastHandledSavedAtRef = useRef<string | null>(null);
  const pendingDraftPayloadRef = useRef<string | null>(null);
  const pendingDirtyPathsRef = useRef<string[]>([]);
  const allowLeaveRef = useRef(false);
  const pendingLeaveDestinationRef = useRef<string | null>(null);
  const savedSnapshotRef = useRef("");
  const previousSnapshotRef = useRef("");
  const previousSavedAtRef = useRef<string | null>(null);
  const lastStatusRef = useRef<PolicySaveStatus | null>(null);
  const saveEpochRef = useRef(0);
  const pendingLeaveAfterSaveRef = useRef(pendingLeaveAfterSave);
  useEffect(() => {
    pendingLeaveAfterSaveRef.current = pendingLeaveAfterSave;
  });

  useEffect(() => {
    const initial = JSON.stringify(form.getValues());
    savedSnapshotRef.current = initial;
    previousSnapshotRef.current = initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time snapshot seed on mount
  }, []);

  const blocker = useBlocker(() => {
    if (allowLeaveRef.current) return false;
    if (isNew) return true;
    return hasUnsavedChangesRef.current;
  });

  useEffect(() => {
    const subscription = form.watch((values) => {
      const snapshot = JSON.stringify(values);
      const dirty = snapshot !== savedSnapshotRef.current;
      setHasUnsavedChanges((prev) => (prev === dirty ? prev : dirty));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  function publishSaveStatus(status: PolicySaveStatus) {
    if (lastStatusRef.current === status) return;
    lastStatusRef.current = status;
    setSaveStatus(status);
  }

  useEffect(() => {
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
  }, [draftSaveError, draftSavedAt, hasUnsavedChanges]);

  async function persistDraft({
    force = false,
    requireComplete = false,
  }: { force?: boolean; requireComplete?: boolean } = {}) {
    if (isSavingDraftRef.current) return false;
    if (!force && !hasUnsavedChangesRef.current) return false;

    if (requireComplete) {
      const valid = await form.trigger();
      if (!valid) {
        setDraftSaveError(
          "Client could not be saved. Check the form and try again.",
        );
        publishSaveStatus("error");
        if (pendingLeaveAfterSaveRef.current) setPendingLeaveAfterSave(false);
        const first = flattenFieldErrors(form.formState.errors)[0];
        if (first) focusFormIssue(form.setFocus, first.path);
        return false;
      }
    }

    const dirtyFromHighlight = getDirtyPaths();
    const dirtyFromRhf = flattenDirtyPaths(form.formState.dirtyFields);
    pendingDirtyPathsRef.current =
      dirtyFromHighlight.length > 0 ? dirtyFromHighlight : dirtyFromRhf;

    const values = form.getValues();
    const payload = JSON.stringify(values);
    pendingDraftPayloadRef.current = payload;

    const epoch = ++saveEpochRef.current;
    previousSnapshotRef.current = savedSnapshotRef.current;
    previousSavedAtRef.current = draftSavedAt;
    const optimisticSavedAt = new Date().toISOString();

    savedSnapshotRef.current = payload;
    setHasUnsavedChanges(false);
    setDraftSaveError(null);
    setDraftSavedAt(optimisticSavedAt);
    commitSavedPaths(pendingDirtyPathsRef.current);
    publishSaveStatus("saved");

    isSavingDraftRef.current = true;

    try {
      const data = await saveClientDraftClient(client.clientId, values, {
        requireComplete,
      });

      if (epoch !== saveEpochRef.current) return false;

      if (!data.ok) {
        savedSnapshotRef.current = previousSnapshotRef.current;
        setDraftSavedAt(previousSavedAtRef.current);
        setHasUnsavedChanges(true);
        rollbackSavedPaths(pendingDirtyPathsRef.current);
        setDraftSaveError(
          data.formError ??
            "Client could not be saved. Check the form and try again.",
        );
        if (data.errors) {
          for (const [field, messages] of Object.entries(data.errors)) {
            const message = messages?.[0];
            if (message) {
              form.setError(field as keyof ClientFormValues, { message });
            }
          }
        }
        publishSaveStatus("error");
        if (pendingLeaveAfterSaveRef.current) setPendingLeaveAfterSave(false);
        return false;
      }

      lastHandledSavedAtRef.current = data.savedAt;
      setDraftSavedAt(data.savedAt);
      setDraftSaveError(null);
      form.clearErrors();

      const currentPayload = JSON.stringify(form.getValues());
      const editedDuringSave =
        !pendingDraftPayloadRef.current ||
        pendingDraftPayloadRef.current !== currentPayload;

      if (editedDuringSave) {
        savedSnapshotRef.current = pendingDraftPayloadRef.current ?? payload;
        setHasUnsavedChanges(true);
      } else {
        savedSnapshotRef.current = currentPayload;
        setHasUnsavedChanges(false);
        publishSaveStatus("saved");
      }

      if (pendingLeaveAfterSaveRef.current) {
        if (editedDuringSave) {
          queueMicrotask(() => {
            void persistDraft({ force: true, requireComplete });
          });
        } else {
          setPendingLeaveAfterSave(false);
          setDiscardConfirmOpen(false);
          allowLeaveRef.current = true;
          const name = form.getValues("name")?.trim() || "Client";
          toast.success(`${name} saved`);
          const destination =
            pendingLeaveDestinationRef.current ?? `/clients/${client.clientId}`;
          pendingLeaveDestinationRef.current = null;
          if (blocker.state === "blocked") {
            blocker.proceed();
          } else {
            navigate(destination);
          }
        }
      }
      return true;
    } catch {
      if (epoch !== saveEpochRef.current) return false;
      savedSnapshotRef.current = previousSnapshotRef.current;
      setDraftSavedAt(previousSavedAtRef.current);
      setHasUnsavedChanges(true);
      rollbackSavedPaths(pendingDirtyPathsRef.current);
      setDraftSaveError("Client could not be saved. Check your connection.");
      publishSaveStatus("error");
      if (pendingLeaveAfterSaveRef.current) setPendingLeaveAfterSave(false);
      return false;
    } finally {
      if (epoch === saveEpochRef.current) {
        isSavingDraftRef.current = false;
      }
    }
  }

  function handleFieldBlur() {
    if (isNew) return;
    if (!hasUnsavedChangesRef.current) return;
    void persistDraft();
  }

  useEffect(() => {
    if (blocker.state === "blocked" && blocker.location) {
      pendingLeaveDestinationRef.current = `${blocker.location.pathname}${blocker.location.search}${blocker.location.hash}`;
    }
    if (blocker.state === "blocked" && !isNew && !hasUnsavedChanges) {
      if (pendingLeaveAfterSaveRef.current) return;
      blocker.reset();
    }
  }, [blocker, hasUnsavedChanges, isNew]);

  async function discardNewClient() {
    setDiscarding(true);
    setDraftSaveError(null);
    try {
      const result = await discardClientDraftClient(client.clientId);
      if (!result.ok) {
        setDraftSaveError(
          result.formError ?? "Could not discard this client. Try again.",
        );
        setDiscardConfirmOpen(false);
        if (blocker.state === "blocked") blocker.reset();
        return;
      }
      allowLeaveRef.current = true;
      setDiscardConfirmOpen(false);
      if (blocker.state === "blocked") {
        blocker.proceed();
      } else {
        navigate("/clients");
      }
    } catch {
      setDraftSaveError(
        "Could not discard this client. Check your connection.",
      );
      setDiscardConfirmOpen(false);
      if (blocker.state === "blocked") blocker.reset();
    } finally {
      setDiscarding(false);
    }
  }

  async function saveNow() {
    setManualSaving(true);
    try {
      const saved = await persistDraft({
        force: true,
        requireComplete: isNew,
      });
      if (saved) {
        const name = form.getValues("name")?.trim() || "Client";
        toast.success(`${name} saved`);
        allowLeaveRef.current = true;
        navigate(`/clients/${client.clientId}`);
      }
    } finally {
      setManualSaving(false);
    }
  }

  function leaveWithoutSaving() {
    if (isNew) {
      void discardNewClient();
      return;
    }
    allowLeaveRef.current = true;
    setPendingLeaveAfterSave(false);
    if (blocker.state === "blocked") blocker.proceed();
  }

  function saveAndLeave() {
    pendingLeaveAfterSaveRef.current = true;
    setPendingLeaveAfterSave(true);
    void persistDraft({ force: true, requireComplete: isNew });
  }

  function stayOnPage() {
    setPendingLeaveAfterSave(false);
    setDiscardConfirmOpen(false);
    if (blocker.state === "blocked") blocker.reset();
  }

  function handleCancelClick() {
    if (isNew) {
      setDiscardConfirmOpen(true);
      return;
    }
    navigate(cancelTo);
  }

  const watchedValues = form.watch();
  const formHasContent = [
    watchedValues.name,
    watchedValues.tradingName,
    watchedValues.abn,
    watchedValues.phone,
    watchedValues.email,
  ].some((value) => String(value ?? "").trim().length > 0);

  const showSaveAndLeave = isNew ? formHasContent : hasUnsavedChanges;

  const leaveDialogOpen =
    blocker.state === "blocked" ||
    (isNew && discardConfirmOpen) ||
    pendingLeaveAfterSave ||
    discarding;

  return {
    saveStatus,
    draftSaveError,
    manualSaving,
    discarding,
    pendingLeaveAfterSave,
    showSaveAndLeave,
    leaveDialogOpen,
    handleFieldBlur,
    saveNow,
    handleCancelClick,
    stayOnPage,
    leaveWithoutSaving,
    saveAndLeave,
  };
}
