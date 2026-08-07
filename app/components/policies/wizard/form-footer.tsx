import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import type { PolicyWizardActionData } from "./hooks/use-premium-calc";

export type WizardFormFooterProps = {
  readOnly: boolean;
  isFormTerminal: boolean;
  actionData: PolicyWizardActionData | undefined;
  onCancel: () => void;
  onSubmit: () => void;
  submitBusy: boolean;
  submitDisabled?: boolean;
};

export function WizardFormFooter({
  readOnly,
  isFormTerminal,
  actionData,
  onCancel,
  onSubmit,
  submitBusy,
  submitDisabled = false,
}: WizardFormFooterProps) {
  const lastToastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!actionData) return;

    if (actionData.formError) {
      const key = `formError:${actionData.formError}`;
      if (lastToastKeyRef.current !== key) {
        lastToastKeyRef.current = key;
        toast.error(actionData.formError);
      }
      return;
    }

    const fieldErrors = actionData.errors
      ? Object.entries(actionData.errors).flatMap(([field, messages]) =>
          (messages ?? []).map((msg) => `${field}: ${msg}`),
        )
      : [];
    if (fieldErrors.length === 0) return;

    const key = `errors:${fieldErrors.join("|")}`;
    if (lastToastKeyRef.current === key) return;
    lastToastKeyRef.current = key;
    toast.error("Please fix the following errors", {
      description: fieldErrors.slice(0, 5).join(" · "),
    });
  }, [actionData]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" onClick={onCancel}>
        {readOnly ? "Back to client" : "Cancel"}
      </Button>

      {!readOnly && !isFormTerminal ? (
        <LoadingButton
          type="button"
          className="ml-auto"
          onClick={onSubmit}
          loading={submitBusy}
          disabled={submitDisabled}
        >
          Submit
        </LoadingButton>
      ) : null}
    </div>
  );
}
