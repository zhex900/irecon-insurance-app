import { useEffect, useRef, useState } from "react";
import type { useFetcher } from "react-router";
import { toast } from "sonner";

import { EMPTY_NOTE_AUTHORS } from "~/hooks/policy/use-note-authors";
import type { Policy } from "~/lib/db/types";
import type { NoteAuthor } from "~/lib/services/users/service";

type NotesActionData = {
  notes?: Policy["notes"];
  noteAuthors?: Record<string, NoteAuthor>;
  formError?: string;
  message?: string;
};

export function usePolicyNotes({
  policy,
  noteAuthors: initialAuthors,
  fetcher,
  onPolicyUpdated,
}: {
  policy: Policy;
  noteAuthors?: Record<string, NoteAuthor>;
  fetcher: ReturnType<typeof useFetcher<NotesActionData>>;
  onPolicyUpdated?: (policy: Policy) => void;
}) {
  const [notes, setNotes] = useState<Policy["notes"]>(policy.notes ?? []);
  const [noteAuthors, setNoteAuthors] = useState<Record<string, NoteAuthor>>(
    initialAuthors ?? EMPTY_NOTE_AUTHORS,
  );
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const saveNoteSawBusyRef = useRef(false);
  const noteFetcherDataRef = useRef(fetcher.data);

  // Resync notes/authors from fresh props or fetcher data during render
  // (React's documented pattern for resetting state when a prop changes) —
  // avoids the extra render pass a useEffect would cost for a plain state copy.
  const [prevPolicyNotes, setPrevPolicyNotes] = useState(policy.notes);
  if (prevPolicyNotes !== policy.notes) {
    setPrevPolicyNotes(policy.notes);
    setNotes(policy.notes ?? []);
  }

  const [prevInitialAuthors, setPrevInitialAuthors] = useState(initialAuthors);
  if (prevInitialAuthors !== initialAuthors) {
    setPrevInitialAuthors(initialAuthors);
    setNoteAuthors(initialAuthors ?? EMPTY_NOTE_AUTHORS);
  }

  const [prevFetcherNotes, setPrevFetcherNotes] = useState(fetcher.data?.notes);
  if (prevFetcherNotes !== fetcher.data?.notes) {
    setPrevFetcherNotes(fetcher.data?.notes);
    if (fetcher.data?.notes) setNotes(fetcher.data.notes);
    if (fetcher.data?.noteAuthors) setNoteAuthors(fetcher.data.noteAuthors);
  }

  useEffect(() => {
    if (!isSavingNote) {
      saveNoteSawBusyRef.current = false;
      return;
    }
    if (fetcher.state !== "idle") {
      saveNoteSawBusyRef.current = true;
      return;
    }
    if (!saveNoteSawBusyRef.current) return;
    saveNoteSawBusyRef.current = false;
    noteFetcherDataRef.current = fetcher.data;
    setIsSavingNote(false);
    if (noteFetcherDataRef.current?.formError) {
      setNoteError(noteFetcherDataRef.current.formError);
      return;
    }
    setNoteError(null);
    if (noteFetcherDataRef.current?.notes) {
      onPolicyUpdated?.({
        ...policy,
        notes: noteFetcherDataRef.current.notes,
      });
    }
    if (
      noteFetcherDataRef.current &&
      "message" in noteFetcherDataRef.current &&
      typeof noteFetcherDataRef.current.message === "string"
    ) {
      toast.success(noteFetcherDataRef.current.message);
    }
  }, [fetcher.state, fetcher.data, isSavingNote, onPolicyUpdated, policy]);

  function addNote(description: string) {
    setNoteError(null);
    setIsSavingNote(true);
    const body = new FormData();
    body.set("intent", "add-note");
    body.set("description", description);
    fetcher.submit(body, {
      method: "post",
      action: `/policies/${policy.policyId}`,
    });
  }

  function updateNote(policyNoteId: number, description: string) {
    setNoteError(null);
    setIsSavingNote(true);
    const body = new FormData();
    body.set("intent", "update-note");
    body.set("policyNoteId", String(policyNoteId));
    body.set("description", description);
    fetcher.submit(body, {
      method: "post",
      action: `/policies/${policy.policyId}`,
    });
  }

  return {
    notes,
    noteAuthors,
    addNote,
    updateNote,
    noteError,
    isSavingNote,
  };
}
