import type { useFetcher } from "react-router";

import { PolicyNotesCard } from "~/components/policies/policy-notes-card";
import type { Policy } from "~/lib/db/types";
import type { NoteAuthor } from "~/lib/services/users/service";

import { usePolicyNotes } from "../hooks/composite/use-notes";
import type { PolicyWizardActionData } from "../hooks/composite/use-premium-calc";
import { usePolicyPhase } from "../hooks/utils/use-mode";
import { policyPhaseCardBorderClass } from "../shared/policy-phase";

type MobileNotesProps = {
  policy: Policy;
  noteAuthors?: Record<string, NoteAuthor>;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  onPolicyUpdated?: (policy: Policy) => void;
};

export function MobileNotes({
  policy,
  noteAuthors,
  fetcher,
  onPolicyUpdated,
}: MobileNotesProps) {
  const { isNew, phase } = usePolicyPhase();
  const notesState = usePolicyNotes({
    policy,
    noteAuthors,
    fetcher,
    onPolicyUpdated,
  });

  if (isNew) return null;

  return (
    <div className="xl:hidden">
      <PolicyNotesCard
        notes={notesState.notes ?? []}
        noteAuthors={notesState.noteAuthors}
        canAddNotes={!policy.isDraft}
        onAddNote={notesState.addNote}
        onUpdateNote={notesState.updateNote}
        noteBusy={notesState.isSavingNote}
        noteError={notesState.noteError}
        className={policyPhaseCardBorderClass(phase)}
      />
    </div>
  );
}
