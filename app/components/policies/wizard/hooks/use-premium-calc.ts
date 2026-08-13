import type { useFetcher } from "react-router";
import { type UseFormReturn } from "react-hook-form";
import type { Policy } from "~/lib/db/types";
import { usePolicyWizardMode } from "../car-policy-wizard-mode-context";
import { usePremiumStateManagement } from "./use-premium-state-management";
import { usePremiumFetcherState, usePremiumFetcherUpdates } from "./use-premium-calculation";
import { useReferralReasons } from "./use-referral-reasons";
import { usePremiumActions } from "./use-premium-actions";
import { usePremiumAutoCalculation } from "./use-premium-auto-calculation";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

export type PolicyWizardActionData = {
  ok?: boolean;
  savedAt?: string;
  formError?: string;
  premium?: Policy["car"]["premium"];
  referralReasons?: string[];
  rating?: Policy["car"]["rating"];
  notes?: Policy["notes"];
  noteAuthors?: Record<string, NoteAuthor>;
  errors?: Record<string, string[] | undefined>;
  draft?: boolean;
  message?: string;
};

type NoteAuthor = any; // Re-exported for compatibility

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
    premiumManualKeysRef,
    fieldsLocked,
  } = usePremiumStateManagement({
    policy,
  });

  // Fetcher state and updates
  const { rating, isFetcherBusy, isCalculating } = usePremiumFetcherState({
    fetcher,
    policy,
  });

  usePremiumFetcherUpdates({
    fetcher,
    premiumManuallyEditedRef,
    setPremium,
  });

  // Referral reasons calculation
  const { referralReasons, setReferralReasons } = useReferralReasons({
    policy,
    form,
    rating,
  });

  // Premium actions
  const { submitIntent, resetManualPremium, refreshPremiumAfterSave } = usePremiumActions({
    policy,
    form,
    fetcher,
    fieldsLocked,
    premiumManuallyEditedRef,
    premiumManualKeysRef,
  });

  // Auto-calculation
  usePremiumAutoCalculation({
    policy,
    form,
    fetcher,
    premiumSectionOpen,
    fieldsLocked,
    premiumManuallyEditedRef,
  });

  return {
    premium,
    setPremium,
    premiumRef,
    premiumManuallyEditedRef,
    premiumManualKeysRef,
    referralReasons,
    setReferralReasons,
    isFetcherBusy,
    isCalculating,
    submitIntent,
    resetManualPremium,
    refreshPremiumAfterSave,
  };
}