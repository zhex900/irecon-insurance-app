import { Header } from "../components/header";
import { useWizardInner } from "./provider";

export function WizardHeader() {
  const { state, props } = useWizardInner();
  const { policy, clientName = "", headerActions } = props;

  return (
    <Header
      policyNumber={state.livePolicyNumber}
      clientId={policy.clientId}
      clientName={clientName}
      coverTypeName={state.coverTypeName || undefined}
      selectedStatus={state.selectedStatus}
      saveStatus={state.saveStatus}
      adjusted={Boolean(policy.car.adjusted)}
      headerActions={headerActions}
      submitDisabled={state.submitDisabled}
      submitBusy={state.submitBusy}
      onRequestSubmit={() => {
        void state.requestSubmit();
      }}
      navItems={state.navItems}
      activeSectionId={state.activeSectionId}
      onNavigateSection={state.navigation.navigateToSection}
      sectionIssueCounts={state.sectionIssueCounts}
      onNavigateToSectionFirstIssue={state.handleSectionIssueCounter}
    />
  );
}