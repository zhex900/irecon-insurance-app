import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useRouteLoaderData } from "react-router";
import { toast } from "sonner";
import type { Policy, PolicyDocument, PremiumBreakdown } from "~/lib/db/types";
import {
  ensureReviewDocumentsClient,
  syncPolicyDocumentLabelsClient,
} from "~/lib/services/policy/documents/documents.client";
import { reviewDocumentsFingerprint } from "~/lib/services/policy/documents/fingerprints";
import { policySnapshotFromForm } from "~/lib/services/policy/documents/snapshot-from-form";
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
  const layoutData = useRouteLoaderData("routes/_app/layout") as
    { broker?: { email?: string } } | undefined;
  const generatedBy =
    policy.createdBy.trim() || layoutData?.broker?.email?.trim() || "unknown";

  const [documents, setDocuments] = useState<PolicyDocument[]>(
    policy.documents ?? [],
  );
  const [isGeneratingDocuments, setIsGeneratingDocuments] = useState(false);
  const documentsRef = useRef(documents);
  const policyRef = useRef(policy);
  useEffect(() => {
    documentsRef.current = documents;
    policyRef.current = policy;
  });

  const lastPolicyIdRef = useRef(policy.policyId);
  useEffect(() => {
    if (lastPolicyIdRef.current === policy.policyId) return;
    lastPolicyIdRef.current = policy.policyId;
    setDocuments(policy.documents ?? []);
  }, [policy.policyId, policy.documents]);

  // Settings label edits are snapshotted onto packs — refresh names when opening a policy.
  useEffect(() => {
    let cancelled = false;
    const currentPolicy = policyRef.current;
    const current = currentPolicy.documents ?? [];
    if (current.length === 0) return;

    void syncPolicyDocumentLabelsClient(currentPolicy, current)
      .then((next) => {
        if (cancelled || next === current) return;
        setDocuments(next);
      })
      .catch(() => {
        // Keep stored labels if refresh fails.
      });

    return () => {
      cancelled = true;
    };
  }, [policy.policyId]);

  const buildDocumentSnapshot = useCallback(
    (premiumOverride?: PremiumBreakdown): Policy | null => {
      // Always snapshot form values (Limits SI, sub-limits, etc.) even before
      // premium has been calculated — otherwise PDF preview falls back to the
      // stale loader policy and misses overrides.
      return policySnapshotFromForm(policy, form.getValues(), {
        premium: premiumOverride ?? premium ?? policy.car.premium,
        rating: rating ?? policy.car.rating,
        referralReasons,
        documents: documentsRef.current,
      });
    },
    [policy, form, premium, rating, referralReasons],
  );

  /** True when live form/premium would produce a different doc generation key. */
  function formDataChangedForDocuments(premiumOverride?: PremiumBreakdown) {
    const snapshot = buildDocumentSnapshot(premiumOverride);
    if (!snapshot) return false;
    const nextKey = reviewDocumentsFingerprint(snapshot);
    const previous = documentsRef.current;
    const latestKey = [...previous]
      .reverse()
      .find((doc) => Boolean(doc.templateKey))?.generationKey;
    if (!latestKey) return true;
    // Ignore force suffix if present.
    const baseLatest = latestKey.split("|force|")[0] ?? latestKey;
    return baseLatest !== nextKey;
  }

  async function regenerateDocumentsIfNeeded(options?: {
    cancelled?: () => boolean;
    premiumOverride?: PremiumBreakdown;
    /** Bypass fingerprint match and always append a new Schedule/ROA version. */
    force?: boolean;
  }) {
    const snapshot = buildDocumentSnapshot(options?.premiumOverride);
    if (!snapshot) return;
    if (options?.cancelled?.()) return;

    setIsGeneratingDocuments(true);
    try {
      const previous = documentsRef.current;
      const next = await ensureReviewDocumentsClient(snapshot, generatedBy, {
        force: options?.force,
      });
      if (options?.cancelled?.()) return;
      setDocuments(next);
      if (next !== previous) {
        toast.success("Documents generated", {
          description:
            "Policy PDFs are ready. Open or download them from Premium Summary.",
        });
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
    regenerateDocumentsIfNeeded,
    formDataChangedForDocuments,
    /** Live form + premium snapshot for PDF preview (includes manual overrides). */
    buildDocumentSnapshot,
  };
}
