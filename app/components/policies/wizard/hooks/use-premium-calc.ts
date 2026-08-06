import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { useFetcher } from "react-router";
import type { UseFormReturn } from "react-hook-form";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import {
  buildReferralReasons,
  liabilityLimitLabel,
} from "~/lib/pricing/referral-reasons";
import { rollupPremiumTotals } from "~/lib/pricing/premium-totals";
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
  /** Premium Breakdown lines the broker click-edited (persisted with draft). */
  const premiumManualKeysRef = useRef<string[]>(
    policy.car.premiumManualKeys ?? [],
  );
  const rating = fetcher.data?.rating ?? policy.car.rating;

  const isFetcherBusy = fetcher.state !== "idle";
  const isCalculating =
    isFetcherBusy && fetcher.formData?.get("intent") === "recalculate";

  const lastPolicyIdRef = useRef(policy.policyId);
  const lastPremiumFromPolicyRef = useRef(policy.car.premium);
  useEffect(() => {
    const changed =
      lastPolicyIdRef.current !== policy.policyId ||
      lastPremiumFromPolicyRef.current !== policy.car.premium;
    if (!changed) return;
    lastPolicyIdRef.current = policy.policyId;
    lastPremiumFromPolicyRef.current = policy.car.premium;
    premiumManuallyEditedRef.current = false;
    premiumManualKeysRef.current = policy.car.premiumManualKeys ?? [];
    setPremium(withRolledTotals(policy.car.premium));
  }, [policy.policyId, policy.car.premium, policy.car.premiumManualKeys]);

  const lastFetcherDataRef = useRef(fetcher.data);
  useEffect(() => {
    if (lastFetcherDataRef.current === fetcher.data) return;
    lastFetcherDataRef.current = fetcher.data;
    const data = lastFetcherDataRef.current;
    if (!data?.premium) return;
    // Manual Premium Breakdown edits (ES/DH → folded terrorism) always win
    // over an in-flight server recalculate.
    if (premiumManuallyEditedRef.current) return;
    setPremium(withRolledTotals(data.premium));
  }, [fetcher.data]);

  // Live Limits of Liability / claims (referral DH/ES use limits, not premium).
  const displayHomes = form.watch("displayHomes");
  const existingStructure = form.watch("existingStructure");
  const claimsCountLast3Years = form.watch("claimsCountLast3Years");
  const anyClaimsExceed20k = form.watch("anyClaimsExceed20k");
  const hasExistingContractWorksCover = form.watch(
    "hasExistingContractWorksCover",
  );
  const plantEquipment = form.watch("plantEquipment");
  const liabilityLimitBand = form.watch("liabilityLimitBand");
  const dateStart = form.watch("dateStart");

  const referralReasons = useMemo(() => {
    if (!rating) return policy.car.referralReasons ?? [];
    return buildReferralReasons(
      {
        displayHomes: Number(displayHomes) || 0,
        existingStructure: Number(existingStructure) || 0,
        claimsCountLast3Years: Number(claimsCountLast3Years) || 0,
        anyClaimsExceed20k: Boolean(anyClaimsExceed20k),
        hasExistingContractWorksCover: Boolean(hasExistingContractWorksCover),
        plantEquipment: Number(plantEquipment) || 0,
        liabilityLimitBand: Number(liabilityLimitBand) || 3,
        dateStart: String(dateStart || ""),
      },
      rating,
      liabilityLimitLabel(Number(liabilityLimitBand) || 3),
    );
  }, [
    rating,
    displayHomes,
    existingStructure,
    claimsCountLast3Years,
    anyClaimsExceed20k,
    hasExistingContractWorksCover,
    plantEquipment,
    liabilityLimitBand,
    dateStart,
    policy.car.referralReasons,
  ]);

  // Kept for callers that still pass server reasons after fetch; display is derived.
  const setReferralReasons = useCallback((_reasons: string[]) => {}, []);

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

  /** Clear manual Premium Breakdown overrides and recalculate from rates. */
  function resetManualPremium() {
    if (fieldsLocked) return;
    premiumManuallyEditedRef.current = false;
    premiumManualKeysRef.current = [];
    const parsed = carPolicyPricingSchema.safeParse(form.getValues());
    if (!parsed.success) return;
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
    submitIntent("recalculate");
  }

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
