import { DesktopRail } from "../components/desktop-rail";
import { useWizardInner } from "./provider";

export function WizardDesktopRail() {
  const { state, props } = useWizardInner();
  const { policy } = props;

  return (
    <DesktopRail
      navItems={state.navItems}
      activeSectionId={state.activeSectionId}
      openMap={state.openMap}
      onNavigateSection={state.navigation.navigateToSection}
      onToggleSection={(sectionId, open) => {
        state.setOpenMap((prev) => ({ ...prev, [sectionId]: open }));
      }}
      invalidIssues={state.invalidIssues}
      sectionIssueCounts={state.sectionIssueCounts}
      onNavigateToIssue={state.handleNavigateToIssue}
      onNavigateToSectionFirstIssue={state.handleSectionIssueCounter}
      notes={state.notes}
      noteAuthors={state.noteAuthors}
      policyIsDraft={Boolean(policy.isDraft)}
      onAddNote={state.addNote}
      onUpdateNote={state.updateNote}
      noteBusy={state.isSavingNote}
      noteError={state.noteError}
    />
  );
}