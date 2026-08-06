import type { Policy, PolicyDocument } from "~/lib/db/types";
import type { LibraryDocumentRecord } from "~/lib/documents/library-documents";
import type { BrokerFeeLineInput } from "~/lib/pdf/merge-fields";
import { listReviewDocumentsForConfirm } from "~/lib/services/policy/documents/confirm";
import {
  isPreservedAcrossCoverReplace,
  mergeReviewDocuments,
  reviewPackTemplateSetChanged,
} from "~/lib/services/policy/documents/merge";
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
  policyId: string,
  documents: PolicyDocument[],
): Promise<PolicyDocument[]> {
  const response = await fetch(`/api/policies/${policyId}/documents`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      formError?: string;
    } | null;
    throw new Error(payload?.formError ?? "Failed to save documents");
  }
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
  options?: {
    force?: boolean;
    /** Drop prior cover pack (templates + library) and write the new cover set. */
    replaceCoverPack?: boolean;
    brokerFeeLines?: BrokerFeeLineInput[];
  },
): Promise<PolicyDocument[]> {
  if (!policy.car.premium) return policy.documents ?? [];
  const existing = policy.documents ?? [];
  // Always fetch library docs so label edits refresh onto existing attachments.
  const [libraryDocs, templates] = await Promise.all([
    fetchLibraryDocumentsClient(),
    fetchPublishedTemplatesForCover(policy.car.coverTypeId),
  ]);
  const replaceCoverPack =
    options?.replaceCoverPack === true ||
    reviewPackTemplateSetChanged(
      existing,
      templates.map((template) => template.key),
    );
  // Library / static docs attach once per cover. Cover change replaces them.
  const includeLibrary =
    replaceCoverPack || !policyHasLibraryDocuments(existing);
  const pack = buildReviewDocumentPack(
    policy,
    generatedBy,
    templates,
    replaceCoverPack
      ? existing.filter(isPreservedAcrossCoverReplace)
      : existing,
    libraryDocs,
    { includeLibrary, brokerFeeLines: options?.brokerFeeLines },
  );
  const nextPack = options?.force
    ? pack.map((doc) => ({
        ...doc,
        generationKey: `${doc.generationKey}|force|${Date.now()}`,
      }))
    : pack;
  const merged = mergeReviewDocuments(existing, nextPack, {
    replace: replaceCoverPack,
  });
  const synced = syncPolicyDocumentLabels(merged, {
    libraryDocs,
    templates,
  });
  if (synced === existing) return existing;
  return savePolicyDocumentsClient(policy.policyId, synced);
}

/** Labels for the Submit confirmation dialog (current cover templates + library). */
export async function listReviewDocumentsForConfirmClient(
  policy: Policy,
): Promise<string[]> {
  const [libraryDocs, templates] = await Promise.all([
    fetchLibraryDocumentsClient(),
    fetchPublishedTemplatesForCover(policy.car.coverTypeId),
  ]);
  return listReviewDocumentsForConfirm(policy, { libraryDocs, templates });
}
