import { Badge } from "~/components/reui/badge";
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
import type { TemplateChange } from "~/lib/pdf/template-changelog";

export function LeaveDialog({
  open,
  changes,
  saving,
  onStay,
  onDiscard,
  onSaveAndLeave,
}: {
  open: boolean;
  changes: TemplateChange[];
  saving: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSaveAndLeave: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save your changes?</DialogTitle>
          <DialogDescription>
            You have unsaved edits in the designer (not written as a draft yet).
            Save before leaving, or leave without saving.
          </DialogDescription>
        </DialogHeader>

        {changes.length > 0 ? (
          <ul className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-lg border p-3">
            {changes.map((change) => (
              <li
                key={`${change.kind}-${change.label}`}
                className="flex items-start gap-2 text-sm"
              >
                <ChangeKindBadge kind={change.kind} />
                <span className="min-w-0 flex-1 text-foreground">
                  {change.label}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onStay}
            disabled={saving}
          >
            Stay
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onDiscard}
            disabled={saving}
          >
            Discard & leave
          </Button>
          <LoadingButton
            type="button"
            onClick={onSaveAndLeave}
            loading={saving}
          >
            Save draft & leave
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeKindBadge({ kind }: { kind: TemplateChange["kind"] }) {
  const variant =
    kind === "added"
      ? "success-light"
      : kind === "removed"
        ? "destructive-light"
        : kind === "changed"
          ? "warning-light"
          : "info-light";
  return (
    <Badge variant={variant} size="sm" className="shrink-0 capitalize">
      {kind}
    </Badge>
  );
}
