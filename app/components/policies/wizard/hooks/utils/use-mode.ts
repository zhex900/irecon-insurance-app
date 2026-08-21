import { useContext } from "react";

import { PolicyPhaseContext } from "../../components/mode-context";

export function usePolicyPhase() {
  return useContext(PolicyPhaseContext);
}

/** @deprecated Use usePolicyPhase */
export function useMode() {
  const phase = useContext(PolicyPhaseContext);
  return {
    ...phase,
    /** @deprecated Use canEdit */
    fieldsLocked: !phase.canEdit,
    /** @deprecated Use isSavedTerminal */
    readOnly: phase.isSavedTerminal,
    /** @deprecated Use premiumPinned */
    hasSubmittedOnce: phase.premiumPinned,
    /** @deprecated Use phase */
    wizardMode:
      phase.phase === "new"
        ? ("new" as const)
        : phase.canEdit
          ? ("edit" as const)
          : ("view" as const),
    setSubmittedInSession: () => {},
  };
}
