import { SubmitConfirmDialog, LeaveDiscardDialog } from "./dialogs";

export type CarPolicyWizardDialogsProps = {
  submitConfirmOpen: boolean;
  onSubmitConfirmOpenChange: (open: boolean) => void;
  submitDocumentNames: string[];
  submitBusy: boolean;
  onSubmitConfirm: () => void;
  leaveDialogOpen: boolean;
  isNew: boolean;
  pendingLeaveAfterSave: boolean;
  discarding: boolean;
  onStay: () => void;
  onLeaveWithoutSaving: () => void;
  onSaveAndLeave: () => void;
};

export function CarPolicyWizardDialogs({
  submitConfirmOpen,
  onSubmitConfirmOpenChange,
  submitDocumentNames,
  submitBusy,
  onSubmitConfirm,
  leaveDialogOpen,
  isNew,
  pendingLeaveAfterSave,
  discarding,
  onStay,
  onLeaveWithoutSaving,
  onSaveAndLeave,
}: CarPolicyWizardDialogsProps) {
  return (
    <>
      <SubmitConfirmDialog
        open={submitConfirmOpen}
        onOpenChange={onSubmitConfirmOpenChange}
        documentNames={submitDocumentNames}
        busy={submitBusy}
        onCancel={() => onSubmitConfirmOpenChange(false)}
        onConfirm={onSubmitConfirm}
      />

      <LeaveDiscardDialog
        open={leaveDialogOpen}
        isNew={isNew}
        pendingLeaveAfterSave={pendingLeaveAfterSave}
        discarding={discarding}
        onStay={onStay}
        onLeaveWithoutSaving={onLeaveWithoutSaving}
        onSaveAndLeave={onSaveAndLeave}
      />
    </>
  );
}
