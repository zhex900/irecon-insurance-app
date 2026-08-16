import { useEffect, useRef, useState } from "react";
import type { CarWording, Policy, PolicyDocument } from "~/lib/db/types";
import {
  trackClientDistribution,
  trackClientUsage,
} from "~/lib/observability/metrics.client";
import { buildPdfBlobFromDocument } from "~/lib/pdf/generate";
import { reviewDocumentsFingerprint } from "~/lib/services/policy/documents/fingerprints";
import { isPremiumExcelDocument } from "~/lib/excel/client";

export function usePolicyDocumentPreview({
  previewDoc,
  policy,
  getPreviewPolicy,
  carWording,
  brokerFeeLines,
}: {
  previewDoc: PolicyDocument | null;
  policy?: Policy;
  getPreviewPolicy?: () => Policy | null;
  carWording?: CarWording[];
  brokerFeeLines?: Array<{
    name: string;
    sortOrder: number;
    fee: number;
    feeGst: number;
  }>;
}) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const hadPreviewDocRef = useRef(false);
  const lastPreviewRequestRef = useRef<{
    doc: PolicyDocument;
    fingerprint: string;
  } | null>(null);

  useEffect(() => {
    if (!previewDoc || isPremiumExcelDocument(previewDoc)) {
      lastPreviewRequestRef.current = null;
      if (hadPreviewDocRef.current) {
        hadPreviewDocRef.current = false;
        setPreviewSrc(null);
        setPreviewLoading(false);
        setPreviewError(null);
      }
      return;
    }
    const previewPolicy = getPreviewPolicy?.() ?? policy;
    const fingerprint = previewPolicy
      ? reviewDocumentsFingerprint(previewPolicy)
      : "";
    const previousRequest = lastPreviewRequestRef.current;
    if (
      previousRequest?.doc === previewDoc &&
      previousRequest.fingerprint === fingerprint
    ) {
      return;
    }
    lastPreviewRequestRef.current = { doc: previewDoc, fingerprint };
    hadPreviewDocRef.current = true;

    let cancelled = false;
    let objectUrl: string | null = null;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewSrc(null);

    const started = performance.now();
    void import("~/lib/pdf/pdf-fonts")
      .then(({ getPdfmeFonts }) => getPdfmeFonts())
      .then((font) =>
        buildPdfBlobFromDocument(previewDoc, previewPolicy ?? undefined, {
          wordingCatalogue: carWording,
          brokerFeeLines,
          font,
        }),
      )
      .then((blob) => {
        if (cancelled) return;
        trackClientUsage("pdf.preview", { result: "success" });
        trackClientDistribution(
          "pdf.preview.duration",
          performance.now() - started,
          { unit: "millisecond" },
        );
        objectUrl = URL.createObjectURL(blob);
        setPreviewSrc(objectUrl);
        setPreviewLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        trackClientUsage("pdf.preview", { result: "failure" });
        setPreviewError(
          err instanceof Error ? err.message : "Failed to load PDF",
        );
        setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewDoc, policy, getPreviewPolicy, carWording, brokerFeeLines]);

  return { previewSrc, previewLoading, previewError };
}
