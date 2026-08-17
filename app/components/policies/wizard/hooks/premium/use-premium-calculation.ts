import { useEffect, useRef } from "react";
import type { useFetcher } from "react-router";

import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { parsePositiveInteger } from "~/lib/http/route-input";
import type { NoteAuthor } from "~/lib/services/users/service";

import {
  shouldApplyPremiumResponse,
  withRolledTotals,
} from "./use-premium-utils";

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
  requestId?: number;
};

export function usePremiumFetcherUpdates({
  fetcher,
  premiumManuallyEditedRef,
  latestRequestIdRef,
  setPremium,
}: {
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  premiumManuallyEditedRef: React.MutableRefObject<boolean>;
  latestRequestIdRef: React.MutableRefObject<number>;
  setPremium: (premium: PremiumBreakdown | undefined) => void;
}) {
  const lastFetcherDataRef = useRef(fetcher.data);

  useEffect(() => {
    if (lastFetcherDataRef.current === fetcher.data) return;
    lastFetcherDataRef.current = fetcher.data;

    const data = fetcher.data;
    if (
      !shouldApplyPremiumResponse({
        hasPremium: Boolean(data?.premium),
        isManualEdit: premiumManuallyEditedRef.current,
        responseRequestId: parsePositiveInteger(data?.requestId),
        latestRequestId: latestRequestIdRef.current,
      })
    ) {
      return;
    }

    setPremium(withRolledTotals(data?.premium));
  }, [fetcher.data, latestRequestIdRef, premiumManuallyEditedRef, setPremium]);
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
