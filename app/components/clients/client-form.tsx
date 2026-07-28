import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
  useFormContext,
  type Resolver,
} from "react-hook-form";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AuthorisedRepresentativeAutocomplete } from "~/components/clients/authorised-representative-autocomplete";
import { FormAutocomplete } from "~/components/clients/form-autocomplete";
import { FieldInput } from "~/components/ui/form-controls";
import {
  flattenDirtyPaths,
  JustSavedProvider,
  PolicySaveStatusBadge,
  useJustSaved,
  type PolicySaveStatus,
} from "~/components/forms/field-save-highlight";
import {
  discardClientDraftClient,
  saveClientDraftClient,
} from "~/lib/services/clients/draft.client";
import type { Client, ReferenceData } from "~/lib/db/types";
import {
  clientDraftSchema,
  clientSchema,
  clientToFormValues,
  type ClientFormValues,
} from "~/lib/zod/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { flattenFieldErrors, focusFormIssue } from "~/lib/form-validation-ui";

export function ClientForm({
  client,
  reference,
  cancelTo,
  isNew = false,
}: {
  client: Client;
  reference: ReferenceData;
  cancelTo: string;
  isNew?: boolean;
}) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(
      isNew ? clientSchema : clientDraftSchema,
    ) as Resolver<ClientFormValues>,
    defaultValues: clientToFormValues(client),
    mode: "onBlur",
  });

  return (
    <FormProvider {...form}>
      <JustSavedProvider>
        <ClientFormInner
          client={client}
          reference={reference}
          cancelTo={cancelTo}
          isNew={isNew}
        />
      </JustSavedProvider>
    </FormProvider>
  );
}

function ClientFormInner({
  client,
  reference,
  cancelTo,
  isNew,
}: {
  client: Client;
  reference: ReferenceData;
  cancelTo: string;
  isNew: boolean;
}) {
  const form = useFormContext<ClientFormValues>();
  const navigate = useNavigate();
  const { commitSavedPaths, rollbackSavedPaths, getDirtyPaths } =
    useJustSaved();

  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<PolicySaveStatus>("idle");
  const [pendingLeaveAfterSave, setPendingLeaveAfterSave] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;
  const isSavingDraftRef = useRef(false);
  const lastHandledSavedAtRef = useRef<string | null>(null);
  const pendingDraftPayloadRef = useRef<string | null>(null);
  const pendingDirtyPathsRef = useRef<string[]>([]);
  const allowLeaveRef = useRef(false);
  const savedSnapshotRef = useRef(JSON.stringify(form.getValues()));
  const previousSnapshotRef = useRef(savedSnapshotRef.current);
  const previousSavedAtRef = useRef<string | null>(null);
  const lastStatusRef = useRef<PolicySaveStatus | null>(null);
  const saveEpochRef = useRef(0);

  // New clients: always confirm before leaving (avoids orphan drafts).
  // Existing clients: only block when there are unsaved edits.
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
        if (pendingLeaveAfterSave) setPendingLeaveAfterSave(false);
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
        if (pendingLeaveAfterSave) setPendingLeaveAfterSave(false);
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

      if (pendingLeaveAfterSave) {
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
          if (blocker.state === "blocked") {
            blocker.proceed();
          } else {
            navigate(`/clients/${client.clientId}`);
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
      if (pendingLeaveAfterSave) setPendingLeaveAfterSave(false);
      return false;
    } finally {
      if (epoch === saveEpochRef.current) {
        isSavingDraftRef.current = false;
      }
    }
  }

  function handleFieldBlur() {
    // New clients only save on explicit Save click.
    if (isNew) return;
    if (!hasUnsavedChangesRef.current) return;
    void persistDraft();
  }

  useEffect(() => {
    if (blocker.state === "blocked" && !isNew && !hasUnsavedChanges) {
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

  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const watchedValues = watch();
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

  return (
    <>
      <Card className="max-w-3xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Client details</CardTitle>
          {!isNew ? <PolicySaveStatusBadge status={saveStatus} /> : null}
        </CardHeader>
        <CardContent>
          <fieldset
            className="flex flex-col gap-6 border-0 p-0"
            onBlurCapture={handleFieldBlur}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FieldInput
                label="Registered Name"
                error={errors.name?.message}
                {...register("name")}
              />
              <FieldInput
                label="Trading Name"
                error={errors.tradingName?.message}
                {...register("tradingName")}
              />
              <FieldInput
                label="ABN"
                inputMode="numeric"
                hint="11 digits (optional)"
                error={errors.abn?.message}
                {...register("abn")}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldInput
                label="Phone"
                error={errors.phone?.message}
                {...register("phone")}
              />
              <FieldInput
                label="Email"
                type="email"
                error={errors.email?.message}
                {...register("email")}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormAutocomplete
                name="accountManagerId"
                label="Account Manager"
                error={errors.accountManagerId?.message}
                placeholder="Search account manager…"
                emptyMessage="No match."
                options={reference.accountManagers.map((item) => ({
                  value: item.accountManagerId,
                  label: item.fullName,
                  secondary: item.abbrev || undefined,
                  searchText: `${item.fullName} ${item.abbrev}`,
                }))}
              />
              <div className="md:col-span-2">
                <AuthorisedRepresentativeAutocomplete
                  options={reference.wholesaleBrokers}
                  error={errors.authorisedRepresentativeId?.message}
                />
              </div>
            </div>

            {draftSaveError ? (
              <p className="text-sm text-destructive">{draftSaveError}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <LoadingButton
                type="button"
                onClick={() => void saveNow()}
                loading={manualSaving}
              >
                Save
              </LoadingButton>
              {isNew ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelClick}
                >
                  Cancel
                </Button>
              ) : (
                <Link to={cancelTo}>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              )}
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <Dialog
        open={leaveDialogOpen}
        onOpenChange={(open) => {
          if (!open) stayOnPage();
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Discard new client?" : "Save your changes?"}
            </DialogTitle>
            <DialogDescription>
              {isNew
                ? "This client has not been saved yet. Discard to leave without creating a client."
                : "You have unsaved changes. Save before leaving, or leave without saving."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={stayOnPage}>
              {isNew ? "Keep editing" : "Stay"}
            </Button>
            <LoadingButton
              type="button"
              variant="ghost"
              onClick={leaveWithoutSaving}
              loading={discarding}
              loadingLabel="Discarding…"
            >
              {isNew ? "Discard" : "Leave without saving"}
            </LoadingButton>
            {showSaveAndLeave ? (
              <LoadingButton
                type="button"
                onClick={saveAndLeave}
                loading={pendingLeaveAfterSave}
                loadingLabel="Saving…"
              >
                {isNew ? "Save & continue" : "Save & leave"}
              </LoadingButton>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
