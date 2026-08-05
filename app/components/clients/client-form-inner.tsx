import { useFormContext } from "react-hook-form";
import { ClientFormFields } from "~/components/clients/client-form-fields";
import { ClientFormLeaveDialog } from "~/components/clients/client-form-leave-dialog";
import { useClientFormDraft } from "~/components/clients/use-client-form-draft";
import { useJustSaved } from "~/components/forms/field-save-highlight";
import type { Client, ReferenceData } from "~/lib/db/types";
import type { ClientFormValues } from "~/lib/zod/client";

export function ClientFormInner({
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
  const { commitSavedPaths, rollbackSavedPaths, getDirtyPaths } =
    useJustSaved();

  const draft = useClientFormDraft({
    client,
    form,
    isNew,
    cancelTo,
    getDirtyPaths,
    commitSavedPaths,
    rollbackSavedPaths,
  });

  return (
    <>
      <ClientFormFields
        reference={reference}
        cancelTo={cancelTo}
        isNew={isNew}
        saveStatus={draft.saveStatus}
        draftSaveError={draft.draftSaveError}
        manualSaving={draft.manualSaving}
        onFieldBlur={draft.handleFieldBlur}
        onSave={() => void draft.saveNow()}
        onCancel={draft.handleCancelClick}
      />

      <ClientFormLeaveDialog
        open={draft.leaveDialogOpen}
        isNew={isNew}
        showSaveAndLeave={draft.showSaveAndLeave}
        discarding={draft.discarding}
        pendingLeaveAfterSave={draft.pendingLeaveAfterSave}
        onStay={draft.stayOnPage}
        onLeaveWithoutSaving={draft.leaveWithoutSaving}
        onSaveAndLeave={draft.saveAndLeave}
      />
    </>
  );
}
