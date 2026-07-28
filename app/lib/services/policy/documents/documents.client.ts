import type { Policy, PolicyDocument } from "~/lib/db/types";
import type { LibraryDocumentRecord } from "~/lib/library-documents";
import { mergeReviewDocuments } from "~/lib/services/policy/documents/merge";
import { buildReviewDocumentPack } from "~/lib/services/policy/documents/packs";

async function fetchLibraryDocumentsClient(): Promise<LibraryDocumentRecord[]> {
  try {
    const response = await fetch("/api/library-documents");
    if (!response.ok) return [];
    const data = (await response.json()) as {
      documents?: LibraryDocumentRecord[];
    };
    return data.documents ?? [];
  } catch {
    return [];
  }
}

/** Persist documents on the policy via the app API. */
export async function savePolicyDocumentsClient(
  policyId: number,
  documents: PolicyDocument[],
): Promise<PolicyDocument[]> {
  const response = await fetch(`/api/policies/${policyId}/documents`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });
  if (!response.ok) throw new Error("Failed to save documents");
  return (await response.json()) as PolicyDocument[];
}

export async function ensureReviewDocumentsClient(
  policy: Policy,
  generatedBy: string,
): Promise<PolicyDocument[]> {
  if (!policy.car.premium) return policy.documents ?? [];
  const existing = policy.documents ?? [];
  const libraryDocs = await fetchLibraryDocumentsClient();
  const pack = buildReviewDocumentPack(
    policy,
    generatedBy,
    existing,
    libraryDocs,
  );
  const merged = mergeReviewDocuments(existing, pack);
  if (merged === existing) return existing;
  return savePolicyDocumentsClient(policy.policyId, merged);
}
