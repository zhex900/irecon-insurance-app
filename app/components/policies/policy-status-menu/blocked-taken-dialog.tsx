import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import type { BlockedRequirement } from "./types";

export function BlockedTakenDialog({
  open,
  requirements,
  onClose,
}: {
  open: boolean;
  requirements: BlockedRequirement[];
  onClose: (rehighlight: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose(true);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Cannot mark as Taken</DialogTitle>
          <DialogDescription>
            Fix the following before this policy can be Taken. Status was not
            changed.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-3">
          {requirements.map((item) => (
            <li
              key={item.label}
              className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2"
            >
              <p className="text-sm font-medium text-warning">{item.label}</p>
              <p className="mt-1 text-sm text-foreground">{item.message}</p>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" onClick={() => onClose(true)}>
            Review highlighted fields
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
