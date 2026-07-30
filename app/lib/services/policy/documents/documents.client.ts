import type { Policy, PolicyDocument } from "~/lib/db/types";
import type { LibraryDocumentRecord } from "~/lib/library-documents";
import { mergeReviewDocuments } from "~/lib/services/policy/documents/merge";
import {
  buildReviewDocumentPack,
  policyHasLibraryDocuments,
} from "~/lib/services/policy/documents/packs";

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

async function fetchPublishedTemplatesForCover(
  coverTypeId: number,
): Promise<Array<{ key: string; title: string }>> {
  try {
    const response = await fetch(
      `/api/document-templates?coverTypeId=${encodeURIComponent(String(coverTypeId))}`,
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      templates?: Array<{ key: string; title: string }>;
    };
    return data.templates ?? [];
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
  options?: { force?: boolean },
): Promise<PolicyDocument[]> {
  if (!policy.car.premium) return policy.documents ?? [];
  const existing = policy.documents ?? [];
  // Library / static docs attach once. Regenerations only produce templates.
  const includeLibrary = !policyHasLibraryDocuments(existing);
  const [libraryDocs, templates] = await Promise.all([
    includeLibrary ? fetchLibraryDocumentsClient() : Promise.resolve([]),
    fetchPublishedTemplatesForCover(policy.car.coverTypeId),
  ]);
  const pack = buildReviewDocumentPack(
    policy,
    generatedBy,
    templates,
    existing,
    libraryDocs,
    { includeLibrary },
  );
  const nextPack = options?.force
    ? pack.map((doc) => ({
        ...doc,
        generationKey: `${doc.generationKey}|force|${Date.now()}`,
      }))
    : pack;
  const merged = mergeReviewDocuments(existing, nextPack);
  if (merged === existing) return existing;
  return savePolicyDocumentsClient(policy.policyId, merged);
}
