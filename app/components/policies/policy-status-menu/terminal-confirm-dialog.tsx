import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { LoadingButton } from "~/components/ui/loading-button";

export function TerminalConfirmDialog({
  open,
  statusName,
  confirmBusy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  statusName: string | null;
  confirmBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = statusName ?? "selected status";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Mark policy as {label}?</DialogTitle>
          <DialogDescription>
            This sets the status to {label}. Taken and Not taken are final and
            cannot be changed afterward.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={confirmBusy}
          >
            Cancel
          </Button>
          <LoadingButton
            type="button"
            onClick={onConfirm}
            loading={confirmBusy}
          >
            Confirm
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
