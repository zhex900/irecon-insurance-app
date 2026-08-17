import { useEffect, useRef, useState } from "react";
import { useRouteLoaderData } from "react-router";

import type { Policy, PolicyDocument } from "~/lib/db/types";
import { syncPolicyDocumentLabelsClient } from "~/lib/services/policy/documents/documents.client";

export function useDocumentLabelSync(options: {
  policyId: string;
  policyRef: { current: Policy };
  setDocuments: (documents: PolicyDocument[]) => void;
}): void {
  const { policyId, policyRef, setDocuments } = options;
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
  }, [policyId, policyRef, setDocuments]);
}

export function useDocumentState({ policy }: { policy: Policy }) {
  const layoutData = useRouteLoaderData("routes/_app/layout") as
    { broker?: { email?: string } } | undefined;
  const generatedBy =
    policy.createdBy.trim() || layoutData?.broker?.email?.trim() || "unknown";

  const [documents, setDocuments] = useState<PolicyDocument[]>(
    policy.documents ?? [],
  );
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

  useDocumentLabelSync({
    policyId: policy.policyId,
    policyRef,
    setDocuments,
  });

  return {
    documents,
    setDocuments,
    documentsRef,
    policyRef,
    generatedBy,
  };
}
