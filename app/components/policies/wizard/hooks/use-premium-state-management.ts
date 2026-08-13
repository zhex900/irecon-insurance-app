import { useEffect, useRef, useState } from "react";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { usePolicyWizardMode } from "../car-policy-wizard-mode-context";
import {
  createPolicySnapshot,
  hasPolicyChanged,
  withRolledTotals,
  type PolicySnapshot,
} from "./use-premium-calc-utils";

export function usePremiumStateManagement({
  policy,
}: {
  policy: Policy;
}) {
  const { fieldsLocked } = usePolicyWizardMode();
  
  const [premium, setPremium] = useState<PremiumBreakdown | undefined>(() =>
    withRolledTotals(policy.car.premium),
  );
  const premiumRef = useRef(premium);
  
  useEffect(() => {
    premiumRef.current = premium;
  });

  /** When true, skip auto-recalculate so click-to-edit premium values stick. */
  const premiumManuallyEditedRef = useRef(false);
  
  /** Premium Breakdown lines the broker click-edited (persisted with draft). */
  const premiumManualKeysRef = useRef<string[]>(
    policy.car.premiumManualKeys ?? [],
  );

  // Track previous policy identity to detect changes
  const prevPolicySnapshotRef = useRef<PolicySnapshot | null>(null);

  // Initialize the snapshot
  useEffect(() => {
    if (!prevPolicySnapshotRef.current) {
      prevPolicySnapshotRef.current = createPolicySnapshot(policy);
    }
  }, [policy]);

  // Reset premium when policy identity changes
  useEffect(() => {
    const currentSnapshot = createPolicySnapshot(policy);
    
    if (!hasPolicyChanged(currentSnapshot, prevPolicySnapshotRef.current)) {
      return;
    }
    
    // Update ref first to prevent race conditions
    prevPolicySnapshotRef.current = currentSnapshot;
    
    // Reset manual edit flags and premium state
    premiumManuallyEditedRef.current = false;
    premiumManualKeysRef.current = policy.car.premiumManualKeys ?? [];
    setPremium(withRolledTotals(policy.car.premium));
  }, [policy, policy.car.premium, policy.car.premiumManualKeys]);

  return {
    premium,
    setPremium,
    premiumRef,
    premiumManuallyEditedRef,
    premiumManualKeysRef,
    fieldsLocked,
  };
}