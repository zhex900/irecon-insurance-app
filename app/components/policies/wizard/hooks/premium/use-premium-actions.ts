import { type RefObject, useCallback } from "react";
import { type UseFormReturn } from "react-hook-form";
import type { useFetcher } from "react-router";
import { toast } from "sonner";

import type { Policy } from "~/lib/db/types";
import { carPolicyPricingSchema } from "~/lib/zod/policy-car";
import { type CarPolicyFormValues } from "~/lib/zod/policy-car";

import { INTENTS } from "../../shared/constants";
import type { PolicyDraftSaveSync } from "../draft/use-draft-types";
import type { PolicyWizardActionData } from "./use-premium-calculation";
import { hasTouchedPricing } from "./use-premium-utils";

export function usePremiumActions({
  policy,
  form,
  fetcher,
  fieldsLocked,
  premiumManuallyEditedRef,
  premiumManualKeysRef,
  latestRequestIdRef,
  draftSaveSyncRef,
  setPremiumManualKeys,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  fieldsLocked: boolean;
  premiumManuallyEditedRef: React.MutableRefObject<boolean>;
  premiumManualKeysRef: React.MutableRefObject<string[]>;
  latestRequestIdRef: React.MutableRefObject<number>;
  draftSaveSyncRef: RefObject<PolicyDraftSaveSync | null>;
  setPremiumManualKeys: (keys: string[]) => void;
}) {
  const submitIntent = useCallback(
    (intent: typeof INTENTS.RECALCULATE) => {
      const requestId = ++latestRequestIdRef.current;

      const values = form.getValues();
      const body = new FormData();
      body.set("intent", intent);
      body.set("payload", JSON.stringify(values));
      body.set("requestId", String(requestId));

      fetcher.submit(body, {
        method: "post",
        action: `/policies/${policy.policyId}`,
      });

      return requestId;
    },
    [form, fetcher, latestRequestIdRef, policy.policyId],
  );

  /** Clear manual Premium Breakdown overrides and recalculate from rates. */
  const resetManualPremium = useCallback(() => {
    if (fieldsLocked) return;
    const parsed = carPolicyPricingSchema.safeParse(form.getValues());
    if (!parsed.success) {
      toast.error("Complete the pricing fields before resetting premium.");
      return;
    }
    premiumManuallyEditedRef.current = false;
    premiumManualKeysRef.current = [];
    setPremiumManualKeys([]);
    void Promise.resolve(
      (async () => {
        const draftSave = draftSaveSyncRef.current;
        if (!draftSave) return;
        draftSave.cancelQueuedDraftSave();
        await draftSave.waitForDraftIdle();
      })(),
    ).then(() => {
      if (fieldsLocked || premiumManuallyEditedRef.current) return;
      submitIntent(INTENTS.RECALCULATE);
    });
  }, [
    draftSaveSyncRef,
    fieldsLocked,
    form,
    premiumManuallyEditedRef,
    premiumManualKeysRef,
    setPremiumManualKeys,
    submitIntent,
  ]);

  /** Keep Premium Summary in sync after draft saves that touch pricing inputs. */
  const refreshPremiumAfterSave = useCallback(
    (dirtyPaths: string[]) => {
      if (fieldsLocked) return;
      if (premiumManuallyEditedRef.current) return;
      if (!hasTouchedPricing(dirtyPaths)) return;

      const parsed = carPolicyPricingSchema.safeParse(form.getValues());
      if (!parsed.success) return;
      submitIntent(INTENTS.RECALCULATE);
    },
    [fieldsLocked, form, premiumManuallyEditedRef, submitIntent],
  );

  return {
    submitIntent,
    resetManualPremium,
    refreshPremiumAfterSave,
  };
}

export type { PolicyWizardActionData };
