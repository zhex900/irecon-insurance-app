import { DialogsContainer } from "../components/dialogs-container";
import { useWizardInner } from "./provider";

export function Dialogs() {
  const { state } = useWizardInner();

  return (
    <DialogsContainer
      submitConfirmOpen={state.submitConfirmOpen}
      onSubmitConfirmOpenChange={state.setSubmitConfirmOpen}
      submitDocumentNames={state.submitDocumentNames}
      submitBusy={state.submitBusy}
      onSubmitConfirm={() => {
        void state.confirmSubmit().then((ok) => {
          if (!ok) return;
          state.setSubmittedInSession(true);
          state.setSubmittedFingerprint(
            JSON.stringify({
              values: state.form.getValues(),
              premium: state.premiumRef.current ?? state.premium ?? null,
            }),
          );
        });
      }}
      leaveDialogOpen={state.leaveDialogOpen}
      pendingLeaveAfterSave={state.pendingLeaveAfterSave}
      discarding={state.discarding}
      onStay={state.stayOnPage}
      onLeaveWithoutSaving={state.leaveWithoutSaving}
      onSaveAndLeave={state.saveAndLeave}
    />
  );
}