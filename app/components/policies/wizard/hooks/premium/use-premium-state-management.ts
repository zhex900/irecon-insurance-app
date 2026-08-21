import { useEffect, useRef, useState } from "react";

import type { Policy, PremiumBreakdown } from "~/lib/db/types";

import { usePolicyPhase } from "../utils/use-mode";
import {
  createPolicySnapshot,
  hasPolicyChanged,
  type PolicySnapshot,
  withRolledTotals,
} from "./use-premium-utils";

export function usePremiumStateManagement({ policy }: { policy: Policy }) {
  const { canEdit } = usePolicyPhase();
  const fieldsLocked = !canEdit;

  const [premium, setPremium] = useState<PremiumBreakdown | undefined>(() =>
    withRolledTotals(policy.car.premium),
  );
  const [premiumManualKeys, setPremiumManualKeys] = useState<string[]>(
    () => policy.car.premiumManualKeys ?? [],
  );
  const premiumRef = useRef(premium);
  const premiumManualKeysRef = useRef(premiumManualKeys);

  useEffect(() => {
    premiumRef.current = premium;
  });
  useEffect(() => {
    premiumManualKeysRef.current = premiumManualKeys;
  });

  /** When true, skip auto-recalculate so click-to-edit premium values stick. */
  const premiumManuallyEditedRef = useRef(false);

  const [prevPolicySnapshot, setPrevPolicySnapshot] = useState<PolicySnapshot>(
    () => createPolicySnapshot(policy),
  );
  const currentSnapshot = createPolicySnapshot(policy);
  if (hasPolicyChanged(currentSnapshot, prevPolicySnapshot)) {
    setPrevPolicySnapshot(currentSnapshot);
    setPremium(withRolledTotals(policy.car.premium));
    setPremiumManualKeys(policy.car.premiumManualKeys ?? []);
  }

  useEffect(() => {
    premiumManuallyEditedRef.current = false;
    premiumManualKeysRef.current = policy.car.premiumManualKeys ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the same identity as the render-time reset above
  }, [policy.policyId, policy.car.premium]);

  return {
    premium,
    setPremium,
    premiumRef,
    premiumManuallyEditedRef,
    premiumManualKeys,
    setPremiumManualKeys,
    premiumManualKeysRef,
    fieldsLocked,
  };
}
