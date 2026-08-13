import { useRef, useCallback } from "react";
import type { useFetcher } from "react-router";
import { type UseFormReturn } from "react-hook-form";
import type { Policy } from "~/lib/db/types";
import { carPolicyPricingSchema } from "~/lib/zod/policy-car";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";
import { INTENTS } from "../constants";
import { hasTouchedPricing } from "./use-premium-calc-utils";

export function usePremiumActions({
  policy,
  form,
  fetcher,
  fieldsLocked,
  premiumManuallyEditedRef,
  premiumManualKeysRef,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  fieldsLocked: boolean;
  premiumManuallyEditedRef: React.MutableRefObject<boolean>;
  premiumManualKeysRef: React.MutableRefObject<string[]>;
}) {
  // Track the latest request ID to prevent stale updates
  const latestRequestIdRef = useRef(0);

  const submitIntent = useCallback((intent: typeof INTENTS.RECALCULATE) => {
    const requestId = ++latestRequestIdRef.current;
    
    const values = form.getValues();
    const body = new FormData();
    body.set("intent", intent);
    body.set("payload", JSON.stringify(values));
    
    fetcher.submit(body, {
      method: "post",
      action: `/policies/${policy.policyId}`,
    });

    return requestId;
  }, [form, fetcher, policy.policyId]);

  /** Clear manual Premium Breakdown overrides and recalculate from rates. */
  const resetManualPremium = useCallback(() => {
    if (fieldsLocked) return;
    premiumManuallyEditedRef.current = false;
    premiumManualKeysRef.current = [];
    const parsed = carPolicyPricingSchema.safeParse(form.getValues());
    if (!parsed.success) return;
    submitIntent(INTENTS.RECALCULATE);
  }, [fieldsLocked, form, premiumManuallyEditedRef, premiumManualKeysRef, submitIntent]);

  /** Keep Premium Summary in sync after draft saves that touch pricing inputs. */
  const refreshPremiumAfterSave = useCallback((dirtyPaths: string[]) => {
    if (fieldsLocked) return;
    if (premiumManuallyEditedRef.current) return;
    if (!hasTouchedPricing(dirtyPaths)) return;

    const parsed = carPolicyPricingSchema.safeParse(form.getValues());
    if (!parsed.success) return;
    submitIntent(INTENTS.RECALCULATE);
  }, [fieldsLocked, form, premiumManuallyEditedRef, submitIntent]);

  return {
    submitIntent,
    resetManualPremium,
    refreshPremiumAfterSave,
  };
}

// Import and re-export types
import type { PolicyWizardActionData } from "./use-premium-calculation";
export type { PolicyWizardActionData };