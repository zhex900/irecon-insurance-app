import { useEffect, useRef, useCallback } from "react";
import type { useFetcher } from "react-router";
import { type UseFormReturn } from "react-hook-form";
import type { Policy } from "~/lib/db/types";
import { carPolicyPricingSchema } from "~/lib/zod/policy-car";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";
import { INTENTS, TIMINGS } from "../constants";

export function usePremiumAutoCalculation({
  policy,
  form,
  fetcher,
  premiumSectionOpen,
  fieldsLocked,
  premiumManuallyEditedRef,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  premiumSectionOpen: boolean;
  fieldsLocked: boolean;
  premiumManuallyEditedRef: React.MutableRefObject<boolean>;
}) {
  // Simple debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce timer
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
  useEffect(() => {
    if (fieldsLocked || !premiumSectionOpen) return;
    if (premiumManuallyEditedRef.current) return;
    if (policy.car.premium) return;
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer for 300ms debounce
    debounceTimerRef.current = setTimeout(() => {
      const parsed = carPolicyPricingSchema.safeParse(form.getValues());
      if (!parsed.success) return;

      const body = new FormData();
      body.set("intent", INTENTS.RECALCULATE);
      body.set("payload", JSON.stringify(parsed.data));
      fetcher.submit(body, {
        method: "post",
        action: `/policies/${policy.policyId}`,
      });
    }, TIMINGS.AUTO_CALCULATION_DEBOUNCE);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when Premium opens
  }, [premiumSectionOpen, fieldsLocked, policy.policyId, policy.car.premium]);

  return {};
}

// Import and re-export types
import type { PolicyWizardActionData } from "./use-premium-calculation";
export type { PolicyWizardActionData };