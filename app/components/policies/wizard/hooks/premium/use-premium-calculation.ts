import { useEffect, useRef } from "react";
import type { useFetcher } from "react-router";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import type { NoteAuthor } from "~/lib/services/users/service";
import { withRolledTotals } from "./use-premium-utils";

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

export function usePremiumFetcherUpdates({
  fetcher,
  premiumManuallyEditedRef,
  setPremium,
}: {
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  premiumManuallyEditedRef: React.MutableRefObject<boolean>;
  setPremium: (premium: PremiumBreakdown | undefined) => void;
}) {
  // Track fetcher data updates
  const lastFetcherDataRef = useRef(fetcher.data);

  useEffect(() => {
    if (lastFetcherDataRef.current === fetcher.data) return;

    // Take atomic snapshot to prevent race conditions
    const snapshot = {
      data: fetcher.data,
      manualEdit: premiumManuallyEditedRef.current,
      timestamp: Date.now(),
    };

    lastFetcherDataRef.current = fetcher.data;

    // Only update premium if data exists AND not manually edited
    // Atomic check to prevent race between check and set
    if (snapshot.data?.premium && !snapshot.manualEdit) {
      setPremium(withRolledTotals(snapshot.data.premium));
    }
  }, [fetcher.data, premiumManuallyEditedRef, setPremium]);
}

export function usePremiumFetcherState({
  fetcher,
  policy,
}: {
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  policy: Policy;
}) {
  const rating = fetcher.data?.rating ?? policy.car.rating;

  const isFetcherBusy = fetcher.state !== "idle";
  const isCalculating =
    isFetcherBusy && fetcher.formData?.get("intent") === "recalculate";

  return {
    rating,
    isFetcherBusy,
    isCalculating,
  };
}
