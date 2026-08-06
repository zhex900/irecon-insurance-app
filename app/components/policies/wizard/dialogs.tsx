import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export type SubmitConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentNames: string[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SubmitConfirmDialog({
  open,
  onOpenChange,
  documentNames,
  busy,
  onCancel,
  onConfirm,
}: SubmitConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Submit policy?</DialogTitle>
          <DialogDescription>
            This will save the policy and generate the following documents:
          </DialogDescription>
        </DialogHeader>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
          {documentNames.length > 0 ? (
            documentNames.map((name) => <li key={name}>{name}</li>)
          ) : (
            <li className="list-none text-muted-foreground">
              No documents configured for this cover type.
            </li>
          )}
        </ul>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <LoadingButton
            type="button"
            loading={busy}
            loadingLabel="Generating…"
            onClick={onConfirm}
          >
            Confirm & generate
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type LeaveDiscardDialogProps = {
  open: boolean;
  isNew: boolean;
  pendingLeaveAfterSave: boolean;
  discarding: boolean;
  onStay: () => void;
  onLeaveWithoutSaving: () => void;
  onSaveAndLeave: () => void | Promise<void>;
};

export function LeaveDiscardDialog({
  open,
  isNew,
  pendingLeaveAfterSave,
  discarding,
  onStay,
  onLeaveWithoutSaving,
  onSaveAndLeave,
}: LeaveDiscardDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Discard new policy?" : "Save your changes?"}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? "This policy has not been saved yet. Discard to leave without creating a policy."
              : "You have unsaved changes. Save before leaving, or leave without saving."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onStay}
            disabled={pendingLeaveAfterSave || discarding}
          >
            {isNew ? "Keep editing" : "Stay"}
          </Button>
          <LoadingButton
            type="button"
            variant="ghost"
            onClick={onLeaveWithoutSaving}
            loading={discarding}
            loadingLabel="Discarding…"
            disabled={pendingLeaveAfterSave}
          >
            {isNew ? "Discard" : "Leave without saving"}
          </LoadingButton>
          <LoadingButton
            type="button"
            onClick={onSaveAndLeave}
            loading={pendingLeaveAfterSave}
            loadingLabel="Saving…"
            disabled={discarding}
          >
            {isNew ? "Save & continue" : "Save & leave"}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
