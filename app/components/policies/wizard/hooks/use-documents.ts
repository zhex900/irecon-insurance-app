import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
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
import {
  buildPremiumExcelDocument,
  downloadPremiumExcelDocument,
  latestPremiumExcelDocument,
  premiumExcelExportEnabled,
  premiumExcelFingerprint,
} from "~/lib/pricing/premium-excel";
import {
  ensureReviewDocumentsClient,
  savePolicyDocumentsClient,
  syncPolicyDocumentLabelsClient,
} from "~/lib/services/policy/documents/documents.client";
import { reviewDocumentsFingerprint } from "~/lib/services/policy/documents/fingerprints";
import { policySnapshotFromForm } from "~/lib/services/policy/documents/snapshot-from-form";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

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
  premiumRef: MutableRefObject<PremiumBreakdown | undefined>;
  /** Session Premium Breakdown keys the broker click-edited. */
  premiumManualKeysRef: MutableRefObject<string[]>;
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
  }) {
    const snapshot = buildDocumentSnapshot(options?.premiumOverride);
    if (!snapshot) return;
    if (options?.cancelled?.()) return;

    setIsGeneratingDocuments(true);
    try {
      const previous = documentsRef.current;
      const next = await ensureReviewDocumentsClient(snapshot, generatedBy, {
        force: options?.force,
        brokerFeeLines,
      });
      if (options?.cancelled?.()) return;
      setDocuments(next);
      if (next !== previous) {
        toast.success("Documents generated", {
          description:
            "Policy PDFs are ready. Open or download them from Premium Summary.",
        });
      }
    } catch (error: unknown) {
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

  async function exportPremiumExcel() {
    const snapshot = buildDocumentSnapshot();
    if (!snapshot?.car.premium) {
      toast.error("Premium not calculated", {
        description: "Calculate premium before exporting to Excel.",
      });
      return;
    }
    const fingerprint = premiumExcelFingerprint(snapshot);
    const needsRegenerate = premiumExcelExportEnabled(
      documentsRef.current,
      fingerprint,
    );

    setIsExportingExcel(true);
    try {
      if (!needsRegenerate) {
        const existing = latestPremiumExcelDocument(documentsRef.current);
        if (existing?.pdfBase64) {
          downloadPremiumExcelDocument(existing);
          return;
        }
        // Fingerprint matched but bytes missing — fall through and rebuild.
      }

      const doc = await buildPremiumExcelDocument({
        policy: snapshot,
        premium: snapshot.car.premium,
        rating: snapshot.car.rating,
        generatedBy,
        existing: documentsRef.current,
      });
      // Download as soon as generation succeeds. Persistence is useful for the
      // Documents history, but a storage/API failure must not block the export.
      downloadPremiumExcelDocument(doc);

      const next = [...documentsRef.current, doc];
      try {
        const saved = await savePolicyDocumentsClient(policy.policyId, next);
        setDocuments(saved);
        toast.success("Excel exported", {
          description: "Saved to Documents and downloaded.",
        });
      } catch {
        toast.warning("Excel downloaded", {
          description:
            "The spreadsheet could not be saved to Documents. You can still use the downloaded file.",
        });
      }
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
