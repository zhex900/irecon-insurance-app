export type LibraryDocumentRecord = {
  libraryDocumentId: number;
  filename: string;
  displayName: string;
  r2Key: string;
  contentType: string;
  sizeBytes: number;
  attachRule: string;
  createdWhen: string;
  createdBy: string;
  updatedWhen: string;
  updatedBy: string;
};

export function libraryDocumentPublicPath(id: number) {
  return `/api/library-documents/${id}`;
}

/** Whether a library doc should attach to this policy (attach_rule). */
export function libraryDocumentMatchesPolicy(
  doc: Pick<LibraryDocumentRecord, "attachRule">,
  policy: { stateId: number },
) {
  const rule = doc.attachRule.trim();
  if (!rule) return true;
  const stateMatch = /^state:(\d+)$/i.exec(rule);
  if (stateMatch) {
    return policy.stateId === Number(stateMatch[1]);
  }
  return true;
}
