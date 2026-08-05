import { Checkbox } from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import type { CoverTypeOption } from "~/components/documents/library-documents-model";
import type { LibraryDocumentRecord } from "~/lib/documents/library-documents";

type CoverTypesDialogProps = {
  document: LibraryDocumentRecord | null;
  coverTypes: CoverTypeOption[];
  selectedIds: number[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (coverTypeId: number, checked: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function LibraryDocumentCoverTypesDialog({
  document: coverEditDoc,
  coverTypes,
  selectedIds: coverDraftIds,
  busy: coverBusy,
  onOpenChange,
  onToggle: toggleCoverDraft,
  onCancel,
  onSave: saveCoverTypes,
}: CoverTypesDialogProps) {
  return (
    <Dialog open={coverEditDoc != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!coverBusy}>
        <DialogHeader>
          <DialogTitle>Cover types</DialogTitle>
          <DialogDescription>
            Choose which cover types include{" "}
            <span className="font-medium text-foreground">
              {coverEditDoc?.displayName ?? "this document"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          {coverTypes.map((cover) => {
            const checked = coverDraftIds.includes(cover.coverTypeId);
            const checkboxId = `cover-type-${cover.coverTypeId}`;
            return (
              <div key={cover.coverTypeId} className="flex items-center gap-2">
                <Checkbox
                  id={checkboxId}
                  checked={checked}
                  disabled={coverBusy}
                  onCheckedChange={(value) =>
                    toggleCoverDraft(cover.coverTypeId, value === true)
                  }
                />
                <Label htmlFor={checkboxId} className="cursor-pointer">
                  {cover.name}
                </Label>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={coverBusy}
            onClick={() => onCancel()}
          >
            Cancel
          </Button>
          <Button type="button" disabled={coverBusy} onClick={saveCoverTypes}>
            {coverBusy ? (
              <>
                <Spinner className="size-3.5" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
