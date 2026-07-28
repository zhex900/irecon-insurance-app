import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { Policy, PolicyDocument, PremiumBreakdown } from "~/lib/db/types";
import { ensureReviewDocumentsClient } from "~/lib/services/policy/documents/documents.client";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

export function usePolicyDocuments({
  policy,
  form,
  premium,
  referralReasons,
  rating,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  premium: PremiumBreakdown | undefined;
  referralReasons: string[];
  rating: Policy["car"]["rating"] | undefined;
}) {
  const [documents, setDocuments] = useState<PolicyDocument[]>(
    policy.documents ?? [],
  );
  const [isGeneratingDocuments, setIsGeneratingDocuments] = useState(false);
  const [showDocsGeneratedAlert, setShowDocsGeneratedAlert] = useState(false);
  const documentsRef = useRef(documents);
  useEffect(() => {
    documentsRef.current = documents;
  });

  const lastPolicyIdRef = useRef(policy.policyId);
  useEffect(() => {
    if (lastPolicyIdRef.current === policy.policyId) return;
    lastPolicyIdRef.current = policy.policyId;
    setDocuments(policy.documents ?? []);
  }, [policy.policyId, policy.documents]);

  // Auto-dismiss the “documents generated” toast.
  useEffect(() => {
    if (!showDocsGeneratedAlert) return;
    const timer = window.setTimeout(() => {
      setShowDocsGeneratedAlert(false);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [showDocsGeneratedAlert]);

  async function regenerateDocumentsIfNeeded(options?: {
    cancelled?: () => boolean;
    premiumOverride?: PremiumBreakdown;
  }) {
    const currentPremium =
      options?.premiumOverride ?? premium ?? policy.car.premium;
    if (!currentPremium) return;
    if (options?.cancelled?.()) return;

    setIsGeneratingDocuments(true);
    try {
      const values = form.getValues();
      const previous = documentsRef.current;
      const snapshot: Policy = {
        ...policy,
        policyStatusId: values.policyStatusId ?? policy.policyStatusId,
        postcode: values.postcode ?? policy.postcode,
        stateId: values.stateId ?? policy.stateId,
        dateStart: values.dateStart ?? policy.dateStart,
        dateEnd: values.dateEnd ?? policy.dateEnd,
        insurerCode: values.insurerCode ?? policy.insurerCode,
        car: {
          ...policy.car,
          siteAddress: values.siteAddress ?? policy.car.siteAddress,
          insuredName: values.insuredName ?? policy.car.insuredName,
          estimatedTurnover:
            values.estimatedTurnover ?? policy.car.estimatedTurnover,
          contractWorksSumInsured:
            values.contractWorksSumInsured ??
            policy.car.contractWorksSumInsured,
          plantEquipment: values.plantEquipment ?? policy.car.plantEquipment,
          existingStructure:
            values.existingStructure ?? policy.car.existingStructure,
          displayHomes: values.displayHomes ?? policy.car.displayHomes,
          premium: currentPremium,
          rating: rating ?? policy.car.rating,
          referralReasons,
        },
        documents: previous,
      };
      const next = await ensureReviewDocumentsClient(
        snapshot,
        policy.createdBy || "broker@demo.local",
      );
      if (options?.cancelled?.()) return;
      setDocuments(next);
      if (next !== previous) {
        setShowDocsGeneratedAlert(true);
      }
    } catch {
      // Keep existing docs if persistence fails.
    } finally {
      if (!options?.cancelled?.()) setIsGeneratingDocuments(false);
    }
  }

  return {
    documents,
    isGeneratingDocuments,
    showDocsGeneratedAlert,
    regenerateDocumentsIfNeeded,
  };
}
