import { SubmitConfirmDialog, LeaveDiscardDialog } from "./dialogs";

export type CarPolicyWizardDialogsProps = {
  submitConfirmOpen: boolean;
  onSubmitConfirmOpenChange: (open: boolean) => void;
  submitDocumentNames: string[];
  submitBusy: boolean;
  onSubmitConfirm: () => void;
  leaveDialogOpen: boolean;
  pendingLeaveAfterSave: boolean;
  discarding: boolean;
  onStay: () => void;
  onLeaveWithoutSaving: () => void;
  onSaveAndLeave: () => void | Promise<void>;
};

export function CarPolicyWizardDialogs({
  submitConfirmOpen,
  onSubmitConfirmOpenChange,
  submitDocumentNames,
  submitBusy,
  onSubmitConfirm,
  leaveDialogOpen,
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
        pendingLeaveAfterSave={pendingLeaveAfterSave}
        discarding={discarding}
        onStay={onStay}
        onLeaveWithoutSaving={onLeaveWithoutSaving}
        onSaveAndLeave={onSaveAndLeave}
      />
    </>
  );
}
