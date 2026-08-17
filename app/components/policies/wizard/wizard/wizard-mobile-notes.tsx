import { MobileNotes } from "../components/mobile-notes";
import { useMode } from "../hooks/utils/use-mode";
import { useWizardInner } from "./provider";

export function WizardMobileNotes() {
  const { state, props } = useWizardInner();
  const { isNew } = useMode();
  const { policy } = props;

  if (isNew) return null;

  return (
    <div className="xl:hidden">
      <MobileNotes
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
