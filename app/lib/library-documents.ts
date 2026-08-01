export type LibraryDocumentRecord = {
  libraryDocumentId: number;
  filename: string;
  displayName: string;
  r2Key: string;
  contentType: string;
  sizeBytes: number;
  attachRule: string;
  /** Cover types that include this doc. Empty = none (not attached to any pack). */
  coverTypeIds: number[];
  createdWhen: string;
  createdBy: string;
  updatedWhen: string;
  updatedBy: string;
};

export function libraryDocumentPublicPath(id: number) {
  return `/api/library-documents/${id}`;
}

type PolicyMatchInput = {
  stateId: number;
  car?: { coverTypeId: number } | null;
  coverTypeId?: number;
};

/** Whether a library doc should attach to this policy (state + cover type). */
export function libraryDocumentMatchesPolicy(
  doc: Pick<LibraryDocumentRecord, "attachRule" | "coverTypeIds">,
  policy: PolicyMatchInput,
) {
  if (doc.coverTypeIds.length === 0) return false;

  const rule = doc.attachRule.trim();
  if (rule) {
    const stateMatch = /^state:(\d+)$/i.exec(rule);
    if (stateMatch && policy.stateId !== Number(stateMatch[1])) {
      return false;
    }
  }

  const coverTypeId = policy.car?.coverTypeId ?? policy.coverTypeId;
  if (coverTypeId == null) return false;
  return doc.coverTypeIds.includes(coverTypeId);
}
