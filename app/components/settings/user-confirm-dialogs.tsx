import { Form, useNavigation } from "react-router";

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
import type { AppUser } from "~/lib/db/types";

export function UserToggleConfirmDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AppUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigation = useNavigation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {user?.disabled ? "Enable user?" : "Disable user?"}
          </DialogTitle>
          <DialogDescription>
            {user?.disabled ? (
              <>
                <span className="font-medium text-foreground">
                  {user?.fullName}
                </span>{" "}
                will be able to sign in again with their email.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {user?.fullName}
                </span>{" "}
                will not be able to sign in until re-enabled.
              </>
            )}
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
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value={user?.disabled ? "enable" : "disable"}
            />
            <input type="hidden" name="id" value={user?.userId ?? ""} />
            <LoadingButton
              type="submit"
              variant={user?.disabled ? "default" : "destructive"}
              loading={
                navigation.state === "submitting" &&
                (navigation.formData?.get("intent") === "enable" ||
                  navigation.formData?.get("intent") === "disable")
              }
            >
              {user?.disabled ? "Enable" : "Disable"}
            </LoadingButton>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserDeleteConfirmDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AppUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigation = useNavigation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Delete user?</DialogTitle>
          <DialogDescription>
            This permanently removes{" "}
            <span className="font-medium text-foreground">
              {user?.fullName}
            </span>{" "}
            ({user?.email}). They will no longer be able to sign in.
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
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={user?.userId ?? ""} />
            <LoadingButton
              type="submit"
              variant="destructive"
              loading={
                navigation.state === "submitting" &&
                navigation.formData?.get("intent") === "delete"
              }
            >
              Delete
            </LoadingButton>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
