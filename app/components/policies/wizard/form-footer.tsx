import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import type { PolicyWizardActionData } from "./hooks/use-premium-calc";

export type WizardFormFooterProps = {
  readOnly: boolean;
  isFormTerminal: boolean;
  actionData: PolicyWizardActionData | undefined;
  onCancel: () => void;
  onSave: () => void;
  onSubmit: () => void;
  manualSaving: boolean;
  submitBusy: boolean;
};

export function WizardFormFooter({
  readOnly,
  isFormTerminal,
  actionData,
  onCancel,
  onSave,
  onSubmit,
  manualSaving,
  submitBusy,
}: WizardFormFooterProps) {
  return (
    <>
      {actionData?.formError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionData.formError}</AlertDescription>
        </Alert>
      ) : null}

      {actionData?.errors &&
      Object.values(actionData.errors).some(
        (messages) => (messages?.length ?? 0) > 0,
      ) ? (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-medium">Please fix the following errors:</p>
            <ul className="mt-2 list-disc pl-5">
              {Object.entries(actionData.errors).flatMap(([field, messages]) =>
                (messages ?? []).map((msg) => (
                  <li key={`${field}-${msg}`}>
                    {field}: {msg}
                  </li>
                )),
              )}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {readOnly ? "Back to client" : "Cancel"}
        </Button>

        {!readOnly && !isFormTerminal ? (
          <>
            <LoadingButton
              type="button"
              className="ml-auto"
              onClick={onSave}
              loading={manualSaving}
              loadingLabel="Saving…"
            >
              Save
            </LoadingButton>
            <LoadingButton
              type="button"
              variant="secondary"
              onClick={onSubmit}
              loading={submitBusy}
              loadingLabel="Submitting…"
            >
              Submit
            </LoadingButton>
          </>
        ) : null}
      </div>
    </>
  );
}
