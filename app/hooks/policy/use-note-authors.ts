import { useEffect, useSyncExternalStore } from "react";

import { useHydrated } from "~/hooks/network";
import type { NoteAuthor } from "~/lib/services/users/service";

/** Stable empty map — avoids resetting consumers that sync on reference equality. */
export const EMPTY_NOTE_AUTHORS: Record<string, NoteAuthor> = {};

const noteAuthorsCache = new Map<string, Record<string, NoteAuthor>>();
const noteAuthorsInflight = new Map<
  string,
  Promise<Record<string, NoteAuthor>>
>();
const noteAuthorsFailed = new Set<string>();
const noteAuthorsListeners = new Set<() => void>();

function notifyNoteAuthorsListeners() {
  noteAuthorsListeners.forEach((listener) => listener());
}

function subscribeNoteAuthors(listener: () => void) {
  noteAuthorsListeners.add(listener);
  return () => {
    noteAuthorsListeners.delete(listener);
  };
}

function noteAuthorsUrl(policyId: string) {
  return `/api/policies/${policyId}/note-authors`;
}

function loadNoteAuthors(policyId: string) {
  const cached = noteAuthorsCache.get(policyId);
  if (cached) return Promise.resolve(cached);

  const inflight = noteAuthorsInflight.get(policyId);
  if (inflight) return inflight;

  const promise = fetch(noteAuthorsUrl(policyId), {
    credentials: "same-origin",
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to load note authors");
      }
      return (await response.json()) as Record<string, NoteAuthor>;
    })
    .then((data) => {
      noteAuthorsCache.set(policyId, data);
      noteAuthorsInflight.delete(policyId);
      noteAuthorsFailed.delete(policyId);
      notifyNoteAuthorsListeners();
      return data;
    })
    .catch((error) => {
      noteAuthorsInflight.delete(policyId);
      noteAuthorsFailed.add(policyId);
      notifyNoteAuthorsListeners();
      throw error;
    });

  noteAuthorsInflight.set(policyId, promise);
  notifyNoteAuthorsListeners();
  return promise;
}

/** Seed or refresh the in-memory cache after note mutations. */
export function primePolicyNoteAuthorsCache(
  policyId: string,
  noteAuthors: Record<string, NoteAuthor>,
) {
  noteAuthorsCache.set(policyId, noteAuthors);
  noteAuthorsFailed.delete(policyId);
  notifyNoteAuthorsListeners();
}

/** Note author profiles — loaded when the policy has notes. */
export function usePolicyNoteAuthors(policyId: string, hasNotes: boolean) {
  const hydrated = useHydrated();
  const noteAuthors = useSyncExternalStore(
    subscribeNoteAuthors,
    () => noteAuthorsCache.get(policyId) ?? EMPTY_NOTE_AUTHORS,
    () => EMPTY_NOTE_AUTHORS,
  );
  const isLoading = useSyncExternalStore(
    subscribeNoteAuthors,
    () => noteAuthorsInflight.has(policyId),
    () => false,
  );

  useEffect(() => {
    if (!hasNotes || !hydrated) return;
    if (noteAuthorsCache.has(policyId)) return;
    if (noteAuthorsInflight.has(policyId)) return;
    if (noteAuthorsFailed.has(policyId)) return;
    void loadNoteAuthors(policyId).catch(() => undefined);
  }, [hasNotes, hydrated, policyId]);

  const hasCachedAuthors = noteAuthors !== EMPTY_NOTE_AUTHORS;
  const pending =
    hasNotes &&
    hydrated &&
    !hasCachedAuthors &&
    !noteAuthorsFailed.has(policyId) &&
    isLoading;

  return { noteAuthors, pending };
}
