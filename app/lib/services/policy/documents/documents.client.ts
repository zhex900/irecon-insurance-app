import type { Policy, PolicyDocument } from "~/lib/db/types";
import type { LibraryDocumentRecord } from "~/lib/library-documents";
import { mergeReviewDocuments } from "~/lib/services/policy/documents/merge";
import {
  buildReviewDocumentPack,
  policyHasLibraryDocuments,
  syncPolicyDocumentLabels,
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
): Promise<Array<{ key: string; title: string; label: string }>> {
  try {
    const response = await fetch(
      `/api/document-templates?coverTypeId=${encodeURIComponent(String(coverTypeId))}`,
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      templates?: Array<{ key: string; title: string; label?: string }>;
    };
    return (data.templates ?? []).map((t) => ({
      key: t.key,
      title: t.title,
      label: t.label ?? "",
    }));
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

/**
 * Pull current library / template labels onto stored policy documents.
 * No-op (same array) when labels already match.
 */
export async function syncPolicyDocumentLabelsClient(
  policy: Policy,
  documents: PolicyDocument[] = policy.documents ?? [],
): Promise<PolicyDocument[]> {
  if (documents.length === 0) return documents;

  const [libraryDocs, templates] = await Promise.all([
    fetchLibraryDocumentsClient(),
    fetchPublishedTemplatesForCover(policy.car.coverTypeId),
  ]);
  const synced = syncPolicyDocumentLabels(documents, {
    libraryDocs,
    templates,
  });
  if (synced === documents) return documents;
  return savePolicyDocumentsClient(policy.policyId, synced);
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
  // Always fetch library docs so label edits refresh onto existing attachments.
  const [libraryDocs, templates] = await Promise.all([
    fetchLibraryDocumentsClient(),
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
  const synced = syncPolicyDocumentLabels(merged, {
    libraryDocs,
    templates,
  });
  if (synced === existing) return existing;
  return savePolicyDocumentsClient(policy.policyId, synced);
}
