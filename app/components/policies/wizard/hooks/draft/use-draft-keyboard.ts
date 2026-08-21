import { useEffect, useRef } from "react";

import { usePolicyPhase } from "../utils/use-mode";

/** Cmd/Ctrl+S — same draft save path as blur autosave. */
export function usePolicyDraftKeyboardSave(saveDraftNow: () => void) {
  const saveDraftNowRef = useRef(saveDraftNow);
  const { canEdit } = usePolicyPhase();

  useEffect(() => {
    saveDraftNowRef.current = saveDraftNow;
  }, [saveDraftNow]);

  useEffect(() => {
    if (!canEdit) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key && event.key.toLowerCase() !== "s") return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      event.preventDefault();
      saveDraftNowRef.current();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit]);
}
