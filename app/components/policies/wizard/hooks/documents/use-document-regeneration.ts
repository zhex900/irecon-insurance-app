import { type RefObject, useState } from "react";
import { toast } from "sonner";

import type { Policy, PolicyDocument, PremiumBreakdown } from "~/lib/db/types";
import {
  trackClientDistribution,
  trackClientUsage,
} from "~/lib/observability/metrics.client";
import type { BrokerFeeLineInput } from "~/lib/pdf/merge-fields";
import { ensureReviewDocumentsClient } from "~/lib/services/policy/documents/documents.client";

import type { RegenerateDocumentsOptions } from "./document-utils";

function reportGenerateOutcome(options: {
  previous: PolicyDocument[];
  next: PolicyDocument[];
  started: number;
}): void {
  if (options.next !== options.previous) {
    trackClientUsage("document.generate", {
      result: "success",
      surface: "wizard",
      changed: true,
    });
    trackClientDistribution(
      "document.generate.duration",
      performance.now() - options.started,
      { unit: "millisecond", attributes: { surface: "wizard" } },
    );
    toast.success("Documents generated", {
      description:
        "Policy PDFs are ready. Open or download them from Premium Summary.",
    });
    return;
  }
  trackClientUsage("document.generate", {
    result: "success",
    surface: "wizard",
    changed: false,
  });
}

export function useDocumentRegeneration(options: {
  buildDocumentSnapshot: (premiumOverride?: PremiumBreakdown) => Policy | null;
  generatedBy: string;
  brokerFeeLines?: BrokerFeeLineInput[];
  documentsRef: RefObject<PolicyDocument[]>;
  setDocuments: (documents: PolicyDocument[]) => void;
}) {
  const [isGeneratingDocuments, setIsGeneratingDocuments] = useState(false);

  async function regenerateDocumentsIfNeeded(
    regenOptions?: RegenerateDocumentsOptions,
  ) {
    const snapshot = options.buildDocumentSnapshot(
      regenOptions?.premiumOverride,
    );
    if (!snapshot) return;
    if (regenOptions?.cancelled?.()) return;

    setIsGeneratingDocuments(true);
    const started = performance.now();
    try {
      const previous = options.documentsRef.current;
      const next = await ensureReviewDocumentsClient(
        snapshot,
        options.generatedBy,
        {
          force: regenOptions?.force,
          replaceCoverPack: regenOptions?.replaceCoverPack,
          brokerFeeLines: options.brokerFeeLines,
        },
      );
      if (regenOptions?.cancelled?.()) return;
      options.setDocuments(next);
      reportGenerateOutcome({ previous, next, started });
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
      if (!regenOptions?.cancelled?.()) setIsGeneratingDocuments(false);
    }
  }

  return { isGeneratingDocuments, regenerateDocumentsIfNeeded };
}
