import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import { useHydrated } from "~/hooks/network";
import type { NoteAuthor } from "~/lib/services/users/service";

/** Stable empty map — avoids resetting consumers that sync on reference equality. */
export const EMPTY_NOTE_AUTHORS: Record<string, NoteAuthor> = {};

/** Note author profiles — loaded when the policy has notes. */
export function usePolicyNoteAuthors(policyId: string, hasNotes: boolean) {
  const hydrated = useHydrated();
  const fetcher = useFetcher<Record<string, NoteAuthor>>();
  const loadRef = useRef(fetcher.load);

  useEffect(() => {
    loadRef.current = fetcher.load;
  });

  useEffect(() => {
    if (!hasNotes || !hydrated || fetcher.data || fetcher.state !== "idle")
      return;
    loadRef.current(`/api/policies/${policyId}/note-authors`);
  }, [hasNotes, hydrated, fetcher.data, fetcher.state, policyId]);

  return {
    noteAuthors: fetcher.data ?? EMPTY_NOTE_AUTHORS,
    pending: hasNotes && !fetcher.data && fetcher.state === "loading",
  };
}
