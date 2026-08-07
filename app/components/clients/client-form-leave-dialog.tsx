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

export function ClientFormLeaveDialog({
  open,
  isNew,
  showSaveAndLeave,
  discarding,
  pendingLeaveAfterSave,
  onStay,
  onLeaveWithoutSaving,
  onSaveAndLeave,
}: {
  open: boolean;
  isNew: boolean;
  showSaveAndLeave: boolean;
  discarding: boolean;
  pendingLeaveAfterSave: boolean;
  onStay: () => void;
  onLeaveWithoutSaving: () => void;
  onSaveAndLeave: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onStay();
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
          <Button type="button" variant="outline" onClick={onStay}>
            {isNew ? "Keep editing" : "Stay"}
          </Button>
          <LoadingButton
            type="button"
            variant="ghost"
            onClick={onLeaveWithoutSaving}
            loading={discarding}
          >
            {isNew ? "Discard" : "Leave without saving"}
          </LoadingButton>
          {showSaveAndLeave ? (
            <LoadingButton
              type="button"
              onClick={onSaveAndLeave}
              loading={pendingLeaveAfterSave}
            >
              {isNew ? "Save & continue" : "Save & leave"}
            </LoadingButton>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
