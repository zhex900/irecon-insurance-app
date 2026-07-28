import { useEffect, useRef, useState } from "react";
import type { useFetcher } from "react-router";
import type { UseFormReturn } from "react-hook-form";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import {
  carPolicyPricingSchema,
  pricingFields,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";

export type PolicyWizardActionData = {
  ok?: boolean;
  savedAt?: string;
  formError?: string;
  premium?: Policy["car"]["premium"];
  referralReasons?: string[];
  rating?: Policy["car"]["rating"];
  notes?: Policy["notes"];
  errors?: Record<string, string[] | undefined>;
  draft?: boolean;
  message?: string;
};

export function usePolicyPremiumCalc({
  policy,
  form,
  fetcher,
  fieldsLocked,
  premiumSectionOpen,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  fieldsLocked: boolean;
  premiumSectionOpen: boolean;
}) {
  const [premium, setPremium] = useState<PremiumBreakdown | undefined>(
    policy.car.premium,
  );
  const premiumRef = useRef(premium);
  useEffect(() => {
    premiumRef.current = premium;
  });
  /** When true, skip auto-recalculate so click-to-edit premium values stick. */
  const premiumManuallyEditedRef = useRef(false);
  const [referralReasons, setReferralReasons] = useState<string[]>(
    policy.car.referralReasons ?? [],
  );

  const isFetcherBusy = fetcher.state !== "idle";
  const isCalculating =
    isFetcherBusy && fetcher.formData?.get("intent") === "recalculate";

  const lastPolicyIdRef = useRef(policy.policyId);
  const lastPremiumFromPolicyRef = useRef(policy.car.premium);
  const lastReferralReasonsFromPolicyRef = useRef(policy.car.referralReasons);
  useEffect(() => {
    const changed =
      lastPolicyIdRef.current !== policy.policyId ||
      lastPremiumFromPolicyRef.current !== policy.car.premium ||
      lastReferralReasonsFromPolicyRef.current !== policy.car.referralReasons;
    if (!changed) return;
    lastPolicyIdRef.current = policy.policyId;
    lastPremiumFromPolicyRef.current = policy.car.premium;
    lastReferralReasonsFromPolicyRef.current = policy.car.referralReasons;
    premiumManuallyEditedRef.current = false;
    setPremium(policy.car.premium);
    setReferralReasons(policy.car.referralReasons ?? []);
  }, [policy.policyId, policy.car.premium, policy.car.referralReasons]);

  const lastFetcherDataRef = useRef(fetcher.data);
  useEffect(() => {
    if (lastFetcherDataRef.current === fetcher.data) return;
    lastFetcherDataRef.current = fetcher.data;
    const data = lastFetcherDataRef.current;
    if (data?.premium && !premiumManuallyEditedRef.current) {
      setPremium(data.premium);
    }
    if (data?.referralReasons) {
      setReferralReasons(data.referralReasons);
    }
  }, [fetcher.data]);

  // Auto-calculate premium when Premium section is open (unless user edited values).
  // Use schema.safeParse so empty/incomplete forms are not marked invalid in the UI.
  useEffect(() => {
    if (fieldsLocked || !premiumSectionOpen) return;
    if (premiumManuallyEditedRef.current) return;

    const parsed = carPolicyPricingSchema.safeParse(form.getValues());
    if (!parsed.success) return;

    const body = new FormData();
    body.set("intent", "recalculate");
    body.set("payload", JSON.stringify(parsed.data));
    fetcher.submit(body, {
      method: "post",
      action: `/policies/${policy.policyId}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when Premium opens
  }, [premiumSectionOpen, fieldsLocked, policy.policyId]);

  function submitIntent(intent: "recalculate") {
    const values = form.getValues();
    const body = new FormData();
    body.set("intent", intent);
    body.set("payload", JSON.stringify(values));
    fetcher.submit(body, {
      method: "post",
      action: `/policies/${policy.policyId}`,
    });
  }

  /** Keep Premium Summary in sync after draft saves that touch pricing inputs. */
  function refreshPremiumAfterSave(dirtyPaths: string[]) {
    if (fieldsLocked) return;
    if (premiumManuallyEditedRef.current) return;
    const pricingRoots = new Set<string>(pricingFields);
    const touchedPricing = dirtyPaths.some((path) =>
      pricingRoots.has(path.split(".")[0] ?? path),
    );
    if (!touchedPricing) return;

    const parsed = carPolicyPricingSchema.safeParse(form.getValues());
    if (!parsed.success) return;
    submitIntent("recalculate");
  }

  return {
    premium,
    setPremium,
    premiumRef,
    premiumManuallyEditedRef,
    referralReasons,
    setReferralReasons,
    isFetcherBusy,
    isCalculating,
    submitIntent,
    refreshPremiumAfterSave,
  };
}
