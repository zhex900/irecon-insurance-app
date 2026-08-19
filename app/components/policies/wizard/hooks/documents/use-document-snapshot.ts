import { type RefObject, useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  CarWording,
  Policy,
  PolicyDocument,
  PremiumBreakdown,
} from "~/lib/db/types";
import { reviewDocumentsFingerprint } from "~/lib/services/policy/documents/fingerprints";
import { policySnapshotFromForm } from "~/lib/services/policy/documents/snapshot-from-form";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import { latestDocumentGenerationKey } from "./document-utils";

export function useDocumentSnapshot(options: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  premium: PremiumBreakdown | undefined;
  premiumRef: RefObject<PremiumBreakdown | undefined>;
  premiumManualKeysRef: RefObject<string[]>;
  rating: Policy["car"]["rating"] | undefined;
  referralReasons: string[];
  carWording?: CarWording[];
  documentsRef: RefObject<PolicyDocument[]>;
}) {
  const {
    policy,
    form,
    premium,
    premiumRef,
    premiumManualKeysRef,
    rating,
    referralReasons,
    carWording,
    documentsRef,
  } = options;

  const buildDocumentSnapshot = useCallback(
    (premiumOverride?: PremiumBreakdown): Policy | null => {
      const livePremium =
        premiumOverride ?? premiumRef.current ?? premium ?? policy.car.premium;
      return policySnapshotFromForm(policy, form.getValues(), {
        premium: livePremium,
        premiumManualKeys: premiumManualKeysRef.current,
        rating: rating ?? policy.car.rating,
        referralReasons,
        documents: documentsRef.current,
        carWording,
      });
    },
    [
      policy,
      form,
      premium,
      premiumRef,
      premiumManualKeysRef,
      rating,
      referralReasons,
      carWording,
      documentsRef,
    ],
  );

  function formDataChangedForDocuments(premiumOverride?: PremiumBreakdown) {
    const snapshot = buildDocumentSnapshot(premiumOverride);
    if (!snapshot) return false;
    const nextKey = reviewDocumentsFingerprint(snapshot);
    const baseLatest = latestDocumentGenerationKey(documentsRef.current);
    if (!baseLatest) return true;
    return baseLatest !== nextKey;
  }

  return { buildDocumentSnapshot, formDataChangedForDocuments };
}
