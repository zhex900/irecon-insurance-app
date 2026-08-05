import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Local draft for a URL-backed value. Exposes committed loader/URL state separately
 * from editable draft state. Resets the draft when committed changes externally
 * (e.g. back/forward); skips reset when the caller just committed the same value.
 */
export function useUrlFilterDraft<T>(committed: T) {
  const [draft, setDraft] = useState(committed);
  const pendingCommitRef = useRef<T | null>(null);
  const prevCommittedRef = useRef(committed);

  useEffect(() => {
    const prev = prevCommittedRef.current;
    if (Object.is(prev, committed)) return;
    prevCommittedRef.current = committed;

    if (Object.is(pendingCommitRef.current, committed)) {
      pendingCommitRef.current = null;
      return;
    }

    setDraft((current) => (Object.is(current, prev) ? committed : current));
  }, [committed]);

  const commitDraft = useCallback((next: T) => {
    pendingCommitRef.current = next;
    setDraft(next);
  }, []);

  return {
    committed,
    draft,
    setDraft,
    commitDraft,
  };
}
