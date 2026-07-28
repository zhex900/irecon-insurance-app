import { useEffect, useRef, useState } from "react";
import type { useFetcher } from "react-router";
import { toast } from "sonner";
import type { Policy } from "~/lib/db/types";

type NotesActionData = {
  notes?: Policy["notes"];
  formError?: string;
  message?: string;
};

export function usePolicyNotes({
  policy,
  fetcher,
}: {
  policy: Policy;
  fetcher: ReturnType<typeof useFetcher<NotesActionData>>;
}) {
  const [notes, setNotes] = useState<Policy["notes"]>(policy.notes ?? []);
  const [addNoteError, setAddNoteError] = useState<string | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const addNoteSawBusyRef = useRef(false);
  const noteFetcherDataRef = useRef(fetcher.data);

  const lastPolicyNotesRef = useRef(policy.notes);
  useEffect(() => {
    if (lastPolicyNotesRef.current === policy.notes) return;
    lastPolicyNotesRef.current = policy.notes;
    setNotes(policy.notes ?? []);
  }, [policy.notes]);

  const lastFetcherNotesRef = useRef(fetcher.data?.notes);
  useEffect(() => {
    if (lastFetcherNotesRef.current === fetcher.data?.notes) return;
    lastFetcherNotesRef.current = fetcher.data?.notes;
    if (lastFetcherNotesRef.current) setNotes(lastFetcherNotesRef.current);
  }, [fetcher.data?.notes]);

  useEffect(() => {
    if (!isAddingNote) {
      addNoteSawBusyRef.current = false;
      return;
    }
    if (fetcher.state !== "idle") {
      addNoteSawBusyRef.current = true;
      return;
    }
    if (!addNoteSawBusyRef.current) return;
    addNoteSawBusyRef.current = false;
    noteFetcherDataRef.current = fetcher.data;
    setIsAddingNote(false);
    if (noteFetcherDataRef.current?.formError) {
      setAddNoteError(noteFetcherDataRef.current.formError);
      return;
    }
    setAddNoteError(null);
    if (
      noteFetcherDataRef.current &&
      "message" in noteFetcherDataRef.current &&
      typeof noteFetcherDataRef.current.message === "string"
    ) {
      toast.success(noteFetcherDataRef.current.message);
    }
  }, [fetcher.state, fetcher.data, isAddingNote]);

  function addNote(description: string) {
    setAddNoteError(null);
    setIsAddingNote(true);
    const body = new FormData();
    body.set("intent", "add-note");
    body.set("description", description);
    fetcher.submit(body, {
      method: "post",
      action: `/policies/${policy.policyId}`,
    });
  }

  return {
    notes,
    addNote,
    addNoteError,
    isAddingNote,
  };
}
