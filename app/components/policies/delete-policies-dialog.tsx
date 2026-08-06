import { Form } from "react-router";
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

export type DeletablePolicyRef = {
  policyId: string;
  policyNumber: string;
};

export function DeletePoliciesDialog({
  policies,
  open,
  onOpenChange,
  loading = false,
  formAction,
  intent = "delete",
  error,
  onBeforeSubmit,
}: {
  policies: DeletablePolicyRef[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  /** Defaults to current route action. */
  formAction?: string;
  intent?: string;
  error?: string | null;
  onBeforeSubmit?: () => void;
}) {
  const count = policies.length;
  const single = count === 1 ? policies[0] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {single ? "Delete policy?" : `Delete ${count} policies?`}
          </DialogTitle>
          <DialogDescription>
            {single ? (
              <>
                This permanently removes{" "}
                <span className="font-medium text-foreground">
                  {single.policyNumber}
                </span>
                . This cannot be undone.
              </>
            ) : (
              <>
                This permanently removes{" "}
                <span className="font-medium text-foreground">
                  {count} policies
                </span>
                . This cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Form
            method="post"
            action={formAction}
            onSubmit={() => {
              onBeforeSubmit?.();
            }}
          >
            <input type="hidden" name="intent" value={intent} />
            {policies.map((policy) => (
              <input
                key={policy.policyId}
                type="hidden"
                name="ids"
                value={policy.policyId}
              />
            ))}
            <LoadingButton
              type="submit"
              variant="destructive"
              loading={loading}
              loadingLabel="Deleting…"
            >
              Delete
            </LoadingButton>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
