import { useEffect, useRef, useState } from "react";
import type { useFetcher } from "react-router";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { rollupPremiumTotals } from "~/lib/premium-totals";
import type { NoteAuthor } from "~/lib/services/users/service";
import {
  carPolicyPricingSchema,
  pricingFields,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";

function withRolledTotals(
  next: PremiumBreakdown | undefined,
): PremiumBreakdown | undefined {
  return next ? rollupPremiumTotals(next) : undefined;
}

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
  const [premium, setPremium] = useState<PremiumBreakdown | undefined>(() =>
    withRolledTotals(policy.car.premium),
  );
  const premiumRef = useRef(premium);
  useEffect(() => {
    premiumRef.current = premium;
  });
  /** When true, skip auto-recalculate so click-to-edit premium values stick. */
  const premiumManuallyEditedRef = useRef(false);
  /** Next recalculate response should always replace premium (clears overrides). */
  const forceApplyRecalcRef = useRef(false);
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
    setPremium(withRolledTotals(policy.car.premium));
    setReferralReasons(policy.car.referralReasons ?? []);
  }, [policy.policyId, policy.car.premium, policy.car.referralReasons]);

  const lastFetcherDataRef = useRef(fetcher.data);
  useEffect(() => {
    if (lastFetcherDataRef.current === fetcher.data) return;
    lastFetcherDataRef.current = fetcher.data;
    const data = lastFetcherDataRef.current;
    const applyPremium =
      Boolean(data?.premium) &&
      (!premiumManuallyEditedRef.current || forceApplyRecalcRef.current);
    if (applyPremium && data?.premium) {
      const fromRecalculateButton = forceApplyRecalcRef.current;
      forceApplyRecalcRef.current = false;
      premiumManuallyEditedRef.current = false;
      setPremium(withRolledTotals(data.premium));
      if (fromRecalculateButton) {
        toast.success("Premium recalculated — manual overrides cleared");
      }
    }
    if (data?.referralReasons) {
      setReferralReasons(data.referralReasons);
    }
  }, [fetcher.data]);

  // Auto-calculate only when Premium is open and there is no saved premium yet.
  // Recalculate persists to the DB — skipping when premium exists preserves manual edits.
  // Pricing-field draft saves still refresh via refreshPremiumAfterSave.
  useEffect(() => {
    if (fieldsLocked || !premiumSectionOpen) return;
    if (premiumManuallyEditedRef.current) return;
    if (policy.car.premium) return;

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
  }, [premiumSectionOpen, fieldsLocked, policy.policyId, policy.car.premium]);

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

  /** Force server recalculation; clears the manual-override guard so results apply. */
  function recalculatePremium() {
    if (fieldsLocked) return;
    premiumManuallyEditedRef.current = false;
    forceApplyRecalcRef.current = true;
    submitIntent("recalculate");
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
    // Apply server result even if something else toggled the manual flag mid-flight.
    forceApplyRecalcRef.current = true;
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
    recalculatePremium,
    refreshPremiumAfterSave,
  };
}
