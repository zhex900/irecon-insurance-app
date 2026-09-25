import { useEffect } from "react";

import { usePolicyPhase } from "./use-policy-phase";

/** Session-new policies stop behaving as new after the first successful draft save. */
export function useDismissNewPolicyOnDraftSave(draftSavedAt: string | null) {
  const { isNew, dismissNewPolicy } = usePolicyPhase();

  useEffect(() => {
    if (!isNew || !draftSavedAt) return;
    dismissNewPolicy();
  }, [isNew, draftSavedAt, dismissNewPolicy]);
}
