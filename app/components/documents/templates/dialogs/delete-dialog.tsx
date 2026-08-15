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

export function DocumentTemplateDeleteDialog({
  open,
  title,
  deleting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Delete template?</DialogTitle>
          <DialogDescription>
            This permanently deletes all versions of{" "}
            <span className="font-medium text-foreground">{title}</span>. PDF
            generation for this key will fail until you create and publish
            again. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <LoadingButton
            type="button"
            variant="destructive"
            loading={deleting}
            onClick={onConfirm}
          >
            Delete
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
