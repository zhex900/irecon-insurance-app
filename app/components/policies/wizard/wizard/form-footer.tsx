import { Footer } from "../components/footer";
import { useWizardInner } from "./provider";

export function FormFooter() {
  const { state } = useWizardInner();

  return (
    <Footer
      actionData={state.fetcher.data}
      onCancel={state.handleCancelClick}
      onSubmit={() => {
        void state.requestSubmit();
      }}
      submitBusy={state.submitBusy}
      submitDisabled={state.submitDisabled}
    />
  );
}
