import { memo } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { PremiumBreakdown } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import { LeaveDiscardDialog, SubmitConfirmDialog } from "../wizard-dialogs";

type DialogsContainerProps = {
  form: UseFormReturn<CarPolicyFormValues>;
  premium: PremiumBreakdown | undefined;
  premiumRef: React.RefObject<PremiumBreakdown | undefined>;
  submitConfirmOpen: boolean;
  dismissSubmitConfirm: () => void;
  submitDocumentNames: string[];
  submitBusy: boolean;
  confirmSubmit: () => Promise<boolean>;
  setSubmittedFingerprint: (fingerprint: string) => void;
  pendingLeaveAfterSave: boolean;
  discarding: boolean;
  leaveDialogOpen: boolean;
  stayOnPage: () => void;
  leaveWithoutSaving: () => void;
  saveAndLeave: () => Promise<void>;
};

export const DialogsContainer = memo(function DialogsContainer({
  form,
  premium,
  premiumRef,
  submitConfirmOpen,
  dismissSubmitConfirm,
  submitDocumentNames,
  submitBusy,
  confirmSubmit,
  setSubmittedFingerprint,
  pendingLeaveAfterSave,
  discarding,
  leaveDialogOpen,
  stayOnPage,
  leaveWithoutSaving,
  saveAndLeave,
}: DialogsContainerProps) {
  return (
    <>
      <SubmitConfirmDialog
        open={submitConfirmOpen}
        documentNames={submitDocumentNames}
        busy={submitBusy}
        onCancel={dismissSubmitConfirm}
        onConfirm={() => {
          void confirmSubmit().then((ok) => {
            if (!ok) return;
            setSubmittedFingerprint(
              JSON.stringify({
                values: form.getValues(),
                premium: premiumRef.current ?? premium ?? null,
              }),
            );
          });
        }}
      />

      <LeaveDiscardDialog
        open={leaveDialogOpen}
        pendingLeaveAfterSave={pendingLeaveAfterSave}
        discarding={discarding}
        onStay={stayOnPage}
        onLeaveWithoutSaving={leaveWithoutSaving}
        onSaveAndLeave={saveAndLeave}
      />
    </>
  );
});
