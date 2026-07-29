import { useEffect, useRef, useState } from "react";
import type { useFetcher } from "react-router";
import { toast } from "sonner";
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
}: {
  policy: Policy;
  noteAuthors?: Record<string, NoteAuthor>;
  fetcher: ReturnType<typeof useFetcher<NotesActionData>>;
}) {
  const [notes, setNotes] = useState<Policy["notes"]>(policy.notes ?? []);
  const [noteAuthors, setNoteAuthors] = useState<Record<string, NoteAuthor>>(
    initialAuthors ?? {},
  );
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const saveNoteSawBusyRef = useRef(false);
  const noteFetcherDataRef = useRef(fetcher.data);

  const lastPolicyNotesRef = useRef(policy.notes);
  useEffect(() => {
    if (lastPolicyNotesRef.current === policy.notes) return;
    lastPolicyNotesRef.current = policy.notes;
    setNotes(policy.notes ?? []);
  }, [policy.notes]);

  const lastInitialAuthorsRef = useRef(initialAuthors);
  useEffect(() => {
    if (lastInitialAuthorsRef.current === initialAuthors) return;
    lastInitialAuthorsRef.current = initialAuthors;
    setNoteAuthors(initialAuthors ?? {});
  }, [initialAuthors]);

  const lastFetcherNotesRef = useRef(fetcher.data?.notes);
  useEffect(() => {
    if (lastFetcherNotesRef.current === fetcher.data?.notes) return;
    lastFetcherNotesRef.current = fetcher.data?.notes;
    if (lastFetcherNotesRef.current) setNotes(lastFetcherNotesRef.current);
    if (fetcher.data?.noteAuthors) setNoteAuthors(fetcher.data.noteAuthors);
  }, [fetcher.data?.notes, fetcher.data?.noteAuthors]);

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
    if (
      noteFetcherDataRef.current &&
      "message" in noteFetcherDataRef.current &&
      typeof noteFetcherDataRef.current.message === "string"
    ) {
      toast.success(noteFetcherDataRef.current.message);
    }
  }, [fetcher.state, fetcher.data, isSavingNote]);

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
