import { PolicyNotesCard } from "~/components/policies/policy-notes-card";
import type { PolicyNote } from "~/lib/db/types";
import type { NoteAuthor } from "~/lib/services/users/service";

import { useMode } from "../hooks/utils/use-mode";
import { wizardModeCardBorderClass } from "../shared/wizard-shared";

export function MobileNotes({
  notes,
  noteAuthors,
  policyIsDraft,
  onAddNote,
  onUpdateNote,
  noteBusy,
  noteError,
}: {
  notes?: PolicyNote[];
  noteAuthors: Record<string, NoteAuthor>;
  policyIsDraft: boolean;
  onAddNote: (description: string) => void;
  onUpdateNote: (policyNoteId: number, description: string) => void;
  noteBusy: boolean;
  noteError: string | null;
}) {
  const { wizardMode } = useMode();
  return (
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
  );
}
