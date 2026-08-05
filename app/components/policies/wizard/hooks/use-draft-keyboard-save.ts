import { useEffect, useRef } from "react";

/** Cmd/Ctrl+S — same draft save path as blur autosave. */
export function usePolicyDraftKeyboardSave(
  fieldsLocked: boolean,
  saveDraftNow: () => void,
) {
  const saveDraftNowRef = useRef(saveDraftNow);

  useEffect(() => {
    saveDraftNowRef.current = saveDraftNow;
  }, [saveDraftNow]);

  useEffect(() => {
    if (fieldsLocked) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "s") return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      event.preventDefault();
      saveDraftNowRef.current();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fieldsLocked]);
}
