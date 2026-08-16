import { MobileNotes as MobileNotesComponent } from "../components/mobile-notes";
import { useWizardInner } from "./provider";
import { useMode } from "../hooks/utils/use-mode";

export function MobileNotes() {
  const { state, props } = useWizardInner();
  const { isNew } = useMode();
  const { policy } = props;

  if (isNew) return null;

  return (
    <div className="xl:hidden">
      <MobileNotesComponent
        notes={state.notes}
        noteAuthors={state.noteAuthors}
        policyIsDraft={Boolean(policy.isDraft)}
        onAddNote={state.addNote}
        onUpdateNote={state.updateNote}
        noteBusy={state.isSavingNote}
        noteError={state.noteError}
      />
    </div>
  );
}
