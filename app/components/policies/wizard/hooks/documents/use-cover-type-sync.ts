import { type RefObject, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import type { Policy, PolicyDocument } from "~/lib/db/types";
import { savePolicyDocumentsClient } from "~/lib/services/policy/documents/documents.client";
import { isPreservedAcrossCoverReplace } from "~/lib/services/policy/documents/merge";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import type { RegenerateDocumentsOptions } from "./document-utils";

export function useCoverTypeDocumentSync(options: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  documentsRef: RefObject<PolicyDocument[]>;
  setDocuments: (documents: PolicyDocument[]) => void;
  regenerateDocumentsIfNeeded: (
    regenOptions?: RegenerateDocumentsOptions,
  ) => Promise<void>;
}): void {
  const {
    policy,
    form,
    documentsRef,
    setDocuments,
    regenerateDocumentsIfNeeded,
  } = options;
  const coverTypeId = Number(form.watch("coverTypeId")) || 0;
  const lastCoverTypeIdRef = useRef(
    Number(policy.car.coverTypeId) || coverTypeId,
  );

  useEffect(() => {
    lastCoverTypeIdRef.current = Number(policy.car.coverTypeId) || 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset tracker only when the policy identity changes
  }, [policy.policyId]);

  useEffect(() => {
    if (coverTypeId <= 0) return;
    if (coverTypeId === lastCoverTypeIdRef.current) return;
    lastCoverTypeIdRef.current = coverTypeId;

    let cancelled = false;
    const previous = documentsRef.current;
    const kept = previous.filter(isPreservedAcrossCoverReplace);
    documentsRef.current = kept;
    setDocuments(kept);

    void refreshCoverPack({
      policyId: policy.policyId,
      previous,
      kept,
      cancelled: () => cancelled,
      regenerateDocumentsIfNeeded,
    });

    return () => {
      cancelled = true;
    };
    // regenerateDocumentsIfNeeded closes over latest snapshot builders via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to cover type
  }, [coverTypeId, policy.policyId]);
}

async function refreshCoverPack(options: {
  policyId: string;
  previous: PolicyDocument[];
  kept: PolicyDocument[];
  cancelled: () => boolean;
  regenerateDocumentsIfNeeded: (
    regenOptions?: RegenerateDocumentsOptions,
  ) => Promise<void>;
}): Promise<void> {
  try {
    if (options.kept.length !== options.previous.length) {
      await savePolicyDocumentsClient(options.policyId, options.kept);
    }
    if (options.cancelled()) return;
    await options.regenerateDocumentsIfNeeded({
      cancelled: options.cancelled,
      replaceCoverPack: true,
      force: true,
    });
  } catch (error: unknown) {
    if (options.cancelled()) return;
    toast.error("Could not refresh documents for the new cover type", {
      description: error instanceof Error ? error.message : "Please try again.",
    });
  }
}
