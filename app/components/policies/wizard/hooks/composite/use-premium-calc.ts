import { useRef } from "react";
import { type UseFormReturn } from "react-hook-form";
import type { useFetcher } from "react-router";

import type { Policy } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import type { PolicyDraftSaveSync } from "../draft/use-draft-types";
import { usePremiumActions } from "../premium/use-premium-actions";
import { usePremiumAutoCalculation } from "../premium/use-premium-auto-calculation";
import {
  type PolicyWizardActionData,
  usePremiumFetcherState,
  usePremiumFetcherUpdates,
} from "../premium/use-premium-calculation";
import { useReferralReasons } from "../premium/use-premium-referral-reasons";
import { usePremiumStateManagement } from "../premium/use-premium-state-management";

export type { PolicyWizardActionData };

export type { PolicyDraftSaveSync } from "../draft/use-draft-types";

export function usePolicyPremiumCalc({
  policy,
  form,
  fetcher,
  premiumSectionOpen,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  premiumSectionOpen: boolean;
}) {
  // Premium state management
  const {
    premium,
    setPremium,
    premiumRef,
    premiumManuallyEditedRef,
    premiumManualKeys,
    setPremiumManualKeys,
    premiumManualKeysRef,
    fieldsLocked,
  } = usePremiumStateManagement({
    policy,
  });

  const latestRequestIdRef = useRef(0);
  const draftSaveSyncRef = useRef<PolicyDraftSaveSync | null>(null);

  // Fetcher state and updates
  const { rating, isFetcherBusy, isCalculating } = usePremiumFetcherState({
    fetcher,
    policy,
  });

  usePremiumFetcherUpdates({
    fetcher,
    premiumManuallyEditedRef,
    latestRequestIdRef,
    setPremium,
  });

  // Referral reasons calculation
  const { referralReasons, setReferralReasons } = useReferralReasons({
    policy,
    form,
    rating,
  });

  // Premium actions
  const { submitIntent, resetManualPremium, refreshPremiumAfterSave } =
    usePremiumActions({
      policy,
      form,
      fetcher,
      fieldsLocked,
      premiumManuallyEditedRef,
      premiumManualKeysRef,
      latestRequestIdRef,
      draftSaveSyncRef,
      setPremiumManualKeys,
    });

  // Auto-calculation
  usePremiumAutoCalculation({
    policy,
    form,
    premiumSectionOpen,
    fieldsLocked,
    premiumManuallyEditedRef,
    latestRequestIdRef,
    submitIntent,
  });

  return {
    premium,
    setPremium,
    premiumRef,
    premiumManuallyEditedRef,
    premiumManualKeys,
    setPremiumManualKeys,
    premiumManualKeysRef,
    referralReasons,
    setReferralReasons,
    isFetcherBusy,
    isCalculating,
    submitIntent,
    resetManualPremium,
    refreshPremiumAfterSave,
    draftSaveSyncRef,
  };
}
