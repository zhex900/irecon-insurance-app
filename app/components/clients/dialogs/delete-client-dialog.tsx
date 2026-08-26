import { Form } from "react-router";

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
import type { ClientListItem } from "~/lib/services/clients/list.service";
import { markRecentEntityRemoved } from "~/lib/services/navigation/recent-routes";

export type DeleteClientDialogProps = {
  client: ClientListItem | null;
  deletingInFlight: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteClientDialog({
  client,
  deletingInFlight,
  onOpenChange,
}: DeleteClientDialogProps) {
  return (
    <Dialog open={client != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Delete client?</DialogTitle>
          <DialogDescription>
            This permanently removes{" "}
            <span className="font-medium text-foreground">{client?.name}</span>.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Form
            method="post"
            onSubmit={() => {
              if (client) {
                markRecentEntityRemoved({
                  kind: "client",
                  id: client.clientId,
                });
              }
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={client?.clientId ?? ""} />
            <LoadingButton
              type="submit"
              variant="destructive"
              loading={deletingInFlight}
            >
              Delete
            </LoadingButton>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
