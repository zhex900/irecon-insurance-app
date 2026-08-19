import { memo } from "react";
import type { useFetcher } from "react-router";

import { PolicySectionNav } from "~/components/policies/policy-form-layout";
import { PolicyNotesCard } from "~/components/policies/policy-notes-card";
import type { Policy } from "~/lib/db/types";
import type { NoteAuthor } from "~/lib/services/users/service";

import { usePolicyNotes } from "../hooks/composite/use-notes";
import type { PolicyWizardActionData } from "../hooks/composite/use-premium-calc";
import { useMode } from "../hooks/utils/use-mode";
import type { WizardValidationIssue } from "../hooks/wizard/use-wizard-validation-state";
import { wizardModeCardBorderClass } from "../shared/wizard-shared";

type DesktopRailProps = {
  activeSectionId: string;
  openMap: Record<string, boolean>;
  setOpenMap: (
    map:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  onNavigate: (sectionId: string) => void;
  invalidIssues: WizardValidationIssue[];
  sectionIssueCounts: Record<string, number>;
  onNavigateToIssue: (path: string) => void;
  onNavigateToSectionFirstIssue: (sectionId: string) => void;
  navItems: Array<{ id: string; label: string }>;
  policy: Policy;
  noteAuthors?: Record<string, NoteAuthor>;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  onPolicyUpdated?: (policy: Policy) => void;
};

function DesktopNotes({
  policy,
  noteAuthors,
  fetcher,
  onPolicyUpdated,
  className,
}: {
  policy: Policy;
  noteAuthors?: Record<string, NoteAuthor>;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  onPolicyUpdated?: (policy: Policy) => void;
  className?: string;
}) {
  const notesState = usePolicyNotes({
    policy,
    noteAuthors,
    fetcher,
    onPolicyUpdated,
  });

  return (
    <PolicyNotesCard
      notes={notesState.notes ?? []}
      noteAuthors={notesState.noteAuthors}
      canAddNotes={!policy.isDraft}
      onAddNote={notesState.addNote}
      onUpdateNote={notesState.updateNote}
      noteBusy={notesState.isSavingNote}
      noteError={notesState.noteError}
      className={className}
    />
  );
}

export const DesktopRail = memo(function DesktopRail({
  activeSectionId,
  openMap,
  setOpenMap,
  onNavigate,
  invalidIssues,
  sectionIssueCounts,
  onNavigateToIssue,
  onNavigateToSectionFirstIssue,
  navItems,
  policy,
  noteAuthors,
  fetcher,
  onPolicyUpdated,
}: DesktopRailProps) {
  const { wizardMode, isNew } = useMode();
  const borderClassName = wizardModeCardBorderClass(wizardMode);

  return (
    <aside className="hidden min-h-0 xl:flex xl:h-full xl:flex-col xl:gap-4 xl:overflow-hidden">
      <div className="shrink-0">
        <PolicySectionNav
          activeId={activeSectionId}
          openMap={openMap}
          onNavigate={onNavigate}
          onToggleSection={(sectionId, open) => {
            setOpenMap((prev) => ({ ...prev, [sectionId]: open }));
          }}
          invalidIssues={invalidIssues}
          sectionIssueCounts={sectionIssueCounts}
          onNavigateToIssue={onNavigateToIssue}
          onNavigateToSectionFirstIssue={onNavigateToSectionFirstIssue}
          items={navItems}
          className={borderClassName}
        />
      </div>
      {!isNew ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DesktopNotes
            policy={policy}
            noteAuthors={noteAuthors}
            fetcher={fetcher}
            onPolicyUpdated={onPolicyUpdated}
            className={borderClassName}
          />
        </div>
      ) : null}
    </aside>
  );
});
