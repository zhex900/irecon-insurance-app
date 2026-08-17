import { PolicySectionNav } from "~/components/policies/policy-form-layout";
import { PolicyNotesCard } from "~/components/policies/policy-notes-card";
import type { PolicyNote } from "~/lib/db/types";
import type { NoteAuthor } from "~/lib/services/users/service";

import { useMode } from "../hooks/utils/use-mode";
import { wizardModeCardBorderClass } from "../shared/wizard-shared";

export type DesktopRailProps = {
  navItems: { id: string; label: string }[];
  activeSectionId: string;
  openMap: Record<string, boolean>;
  onNavigateSection: (sectionId: string) => void;
  onToggleSection: (sectionId: string, open: boolean) => void;
  invalidIssues: { path: string; label: string; message?: string }[];
  sectionIssueCounts: Record<string, number>;
  onNavigateToIssue: (path: string) => void;
  onNavigateToSectionFirstIssue: (sectionId: string) => void;
  notes?: PolicyNote[];
  noteAuthors: Record<string, NoteAuthor>;
  policyIsDraft: boolean;
  onAddNote: (description: string) => void;
  onUpdateNote: (policyNoteId: number, description: string) => void;
  noteBusy: boolean;
  noteError: string | null;
};

export function DesktopRail({
  navItems,
  activeSectionId,
  openMap,
  onNavigateSection,
  onToggleSection,
  invalidIssues,
  sectionIssueCounts,
  onNavigateToIssue,
  onNavigateToSectionFirstIssue,
  notes,
  noteAuthors,
  policyIsDraft,
  onAddNote,
  onUpdateNote,
  noteBusy,
  noteError,
}: DesktopRailProps) {
  const { wizardMode, isNew } = useMode();
  return (
    <aside className="hidden min-h-0 xl:flex xl:h-full xl:flex-col xl:gap-4 xl:overflow-hidden">
      <div className="shrink-0">
        <PolicySectionNav
          activeId={activeSectionId}
          openMap={openMap}
          onNavigate={onNavigateSection}
          onToggleSection={onToggleSection}
          invalidIssues={invalidIssues}
          sectionIssueCounts={sectionIssueCounts}
          onNavigateToIssue={onNavigateToIssue}
          onNavigateToSectionFirstIssue={onNavigateToSectionFirstIssue}
          items={navItems}
          className={wizardModeCardBorderClass(wizardMode)}
        />
      </div>
      {!isNew ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PolicyNotesCard
            notes={notes ?? []}
            noteAuthors={noteAuthors}
            canAddNotes={!policyIsDraft}
            onAddNote={onAddNote}
            onUpdateNote={onUpdateNote}
            noteBusy={noteBusy}
            noteError={noteError}
            className={wizardModeCardBorderClass(wizardMode)}
          />
        </div>
      ) : null}
    </aside>
  );
}
