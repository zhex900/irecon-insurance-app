import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { UseFormReturn } from "react-hook-form";
import { useRouteLoaderData } from "react-router";
import { toast } from "sonner";
import type {
  CarWording,
  Policy,
  PolicyDocument,
  PremiumBreakdown,
} from "~/lib/db/types";
import type { BrokerFeeLineInput } from "~/lib/pdf/merge-fields";
import { downloadPremiumExcelDocument } from "~/lib/excel/excel-client";
import {
  ensureReviewDocumentsClient,
  savePolicyDocumentsClient,
  syncPolicyDocumentLabelsClient,
} from "~/lib/services/policy/documents/documents.client";
import { isPreservedAcrossCoverReplace } from "~/lib/services/policy/documents/merge";
import { reviewDocumentsFingerprint } from "~/lib/services/policy/documents/fingerprints";
import { policySnapshotFromForm } from "~/lib/services/policy/documents/snapshot-from-form";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import {
  trackClientDistribution,
  trackClientUsage,
} from "~/lib/observability/metrics.client";

export function usePolicyDocuments({
  policy,
  form,
  premium,
  premiumRef,
  premiumManualKeysRef,
  referralReasons,
  rating,
  carWording,
  brokerFeeLines,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  premium: PremiumBreakdown | undefined;
  /** Latest premium including in-flight manual edits (preferred over state). */
  premiumRef: RefObject<PremiumBreakdown | undefined>;
  /** Session Premium Breakdown keys the broker click-edited. */
  premiumManualKeysRef: RefObject<string[]>;
  referralReasons: string[];
  rating: Policy["car"]["rating"] | undefined;
  /** Fixed Additional Wording catalogue (checkbox list). */
  carWording?: CarWording[];
  brokerFeeLines?: BrokerFeeLineInput[];
}) {
  const layoutData = useRouteLoaderData("routes/_app/layout") as
    { broker?: { email?: string } } | undefined;
  const generatedBy =
    policy.createdBy.trim() || layoutData?.broker?.email?.trim() || "unknown";

  const [documents, setDocuments] = useState<PolicyDocument[]>(
    policy.documents ?? [],
  );
  const [isGeneratingDocuments, setIsGeneratingDocuments] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const documentsRef = useRef(documents);
  const policyRef = useRef(policy);
  useEffect(() => {
    documentsRef.current = documents;
    policyRef.current = policy;
  });

  const lastPolicyIdRef = useRef(policy.policyId);
  const coverTypeId = Number(form.watch("coverTypeId")) || 0;
  const lastCoverTypeIdRef = useRef(
    Number(policy.car.coverTypeId) || coverTypeId,
  );

  useEffect(() => {
    if (lastPolicyIdRef.current === policy.policyId) return;
    lastPolicyIdRef.current = policy.policyId;
    lastCoverTypeIdRef.current = Number(policy.car.coverTypeId) || 0;
    setDocuments(policy.documents ?? []);
  }, [policy.policyId, policy.documents, policy.car.coverTypeId]);

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
      // Prefer premiumRef so Excel/PDF pick up click-to-edit premium before
      // React state has flushed (same pattern as draft save / submit).
      const livePremium =
        premiumOverride ?? premiumRef.current ?? premium ?? policy.car.premium;
      // Always snapshot form values (Limits SI, sub-limits, etc.) even before
      // premium has been calculated — otherwise PDF preview falls back to the
      // stale loader policy and misses overrides.
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
    ],
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
    /** Drop prior cover pack and generate for the current cover type. */
    replaceCoverPack?: boolean;
  }) {
    const snapshot = buildDocumentSnapshot(options?.premiumOverride);
    if (!snapshot) return;
    if (options?.cancelled?.()) return;

    setIsGeneratingDocuments(true);
    const started = performance.now();
    try {
      const previous = documentsRef.current;
      const next = await ensureReviewDocumentsClient(snapshot, generatedBy, {
        force: options?.force,
        replaceCoverPack: options?.replaceCoverPack,
        brokerFeeLines,
      });
      if (options?.cancelled?.()) return;
      setDocuments(next);
      if (next !== previous) {
        trackClientUsage("document.generate", {
          result: "success",
          surface: "wizard",
          changed: true,
        });
        trackClientDistribution(
          "document.generate.duration",
          performance.now() - started,
          { unit: "millisecond", attributes: { surface: "wizard" } },
        );
        toast.success("Documents generated", {
          description:
            "Policy PDFs are ready. Open or download them from Premium Summary.",
        });
      } else {
        trackClientUsage("document.generate", {
          result: "success",
          surface: "wizard",
          changed: false,
        });
      }
    } catch (error: unknown) {
      trackClientUsage("document.generate", {
        result: "failure",
        surface: "wizard",
      });
      toast.error("Document generation failed", {
        description:
          error instanceof Error
            ? error.message
            : "Could not save generated documents.",
      });
    } finally {
      if (!options?.cancelled?.()) setIsGeneratingDocuments(false);
    }
  }

  // Cover type change: clear Annual/Single/OB pack and regenerate for the new cover.
  useEffect(() => {
    if (coverTypeId <= 0) return;
    if (coverTypeId === lastCoverTypeIdRef.current) return;
    lastCoverTypeIdRef.current = coverTypeId;

    let cancelled = false;
    const previous = documentsRef.current;
    const kept = previous.filter(isPreservedAcrossCoverReplace);
    documentsRef.current = kept;
    setDocuments(kept);

    void (async () => {
      try {
        if (kept.length !== previous.length) {
          await savePolicyDocumentsClient(policy.policyId, kept);
        }
        if (cancelled) return;
        await regenerateDocumentsIfNeeded({
          cancelled: () => cancelled,
          replaceCoverPack: true,
          force: true,
        });
      } catch (error: unknown) {
        if (cancelled) return;
        toast.error("Could not refresh documents for the new cover type", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // regenerateDocumentsIfNeeded closes over latest snapshot builders via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to cover type
  }, [coverTypeId, policy.policyId]);

  async function exportPremiumExcel() {
    const snapshot = buildDocumentSnapshot();
    if (!snapshot?.car.premium) {
      toast.error("Premium not calculated", {
        description: "Calculate premium before exporting to Excel.",
      });
      return;
    }

    setIsExportingExcel(true);
    try {
      // Call API endpoint for Excel generation
      const response = await fetch("/api/generate-excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          policy: snapshot,
          premium: snapshot.car.premium,
          rating: snapshot.car.rating,
          generatedBy,
          existing: documentsRef.current,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate Excel");
      }

      const result = await response.json();
      const doc = result.document;
      // Download immediately when generation succeeds
      downloadPremiumExcelDocument(doc);

      toast.success("Excel exported", {
        description: "Downloaded to your computer.",
      });
    } catch (err: unknown) {
      toast.error("Excel export failed", {
        description:
          err instanceof Error
            ? err.message
            : "Could not generate spreadsheet.",
      });
    } finally {
      setIsExportingExcel(false);
    }
  }

  return {
    documents,
    isGeneratingDocuments,
    isExportingExcel,
    exportPremiumExcel,
    regenerateDocumentsIfNeeded,
    formDataChangedForDocuments,
    /** Live form + premium snapshot for PDF preview (includes manual overrides). */
    buildDocumentSnapshot,
  };
}
