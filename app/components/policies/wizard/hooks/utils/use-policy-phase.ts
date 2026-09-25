import { useContext } from "react";

import { PolicyPhaseContext } from "../../components/policy-phase-context";

export function usePolicyPhase() {
  return useContext(PolicyPhaseContext);
}
