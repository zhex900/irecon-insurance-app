import { useEffect, useRef } from "react";
import { type UseFormReturn } from "react-hook-form";

import type { Policy } from "~/lib/db/types";
import { carPolicyPricingSchema } from "~/lib/zod/policy-car";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";

import { INTENTS, TIMINGS } from "../../shared/constants";

export function usePremiumAutoCalculation({
  policy,
  form,
  premiumSectionOpen,
  fieldsLocked,
  premiumManuallyEditedRef,
  latestRequestIdRef,
  submitIntent,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  premiumSectionOpen: boolean;
  fieldsLocked: boolean;
  premiumManuallyEditedRef: React.MutableRefObject<boolean>;
  latestRequestIdRef: React.MutableRefObject<number>;
  submitIntent: (intent: typeof INTENTS.RECALCULATE) => number;
}) {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Auto-calculate only when Premium is open and there is no saved premium yet.
  // Recalculate persists to the DB — skipping when premium exists preserves manual edits.
  // Pricing-field draft saves still refresh via refreshPremiumAfterSave.
  // Debounce so opening Premium does not race a save-triggered recalc; the
  // request-id guard drops the delayed submit if a newer calc already went out.
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (fieldsLocked || !premiumSectionOpen) return;
    if (premiumManuallyEditedRef.current) return;
    if (policy.car.premium) return;

    const scheduledRequestId = latestRequestIdRef.current;

    debounceTimerRef.current = setTimeout(() => {
      if (latestRequestIdRef.current !== scheduledRequestId) return;
      if (premiumManuallyEditedRef.current) return;

      const parsed = carPolicyPricingSchema.safeParse(form.getValues());
      if (!parsed.success) return;

      submitIntent(INTENTS.RECALCULATE);
    }, TIMINGS.AUTO_CALCULATION_DEBOUNCE);

    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when Premium opens
  }, [premiumSectionOpen, fieldsLocked, policy.policyId, policy.car.premium]);
}
