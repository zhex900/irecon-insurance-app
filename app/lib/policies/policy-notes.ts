import {
  POLICY_INFORMATIONAL_NOTE_TYPE_ID,
  POLICY_MESSAGE_NOTE_TYPE_ID,
  POLICY_REFERRAL_NOTE_TYPE_ID,
  type PolicyNote,
} from "~/lib/db/types";

export function buildReferralNotes(
  policyId: string,
  reasons: string[],
  createdBy: string,
): PolicyNote[] {
  if (reasons.length === 0) return [];
  return [
    {
      policyId,
      policyNoteTypeId: POLICY_REFERRAL_NOTE_TYPE_ID,
      description: reasons.join("\n"),
      createdWhen: new Date().toISOString(),
      createdBy,
    },
  ];
}

/** Append referral notes without wiping broker/system notes or duplicating the same text. */
export function mergeReferralNotes(
  existing: PolicyNote[] | undefined,
  policyId: string,
  reasons: string[],
  createdBy: string,
): PolicyNote[] | undefined {
  const referralNotes = buildReferralNotes(policyId, reasons, createdBy);
  if (referralNotes.length === 0) return undefined;
  const current = existing ?? [];
  const nextDesc = referralNotes[0]?.description ?? "";
  if (
    current.some(
      (note) =>
        note.policyNoteTypeId === POLICY_REFERRAL_NOTE_TYPE_ID &&
        note.description === nextDesc,
    )
  ) {
    return undefined;
  }
  return [...current, ...referralNotes];
}

export function createMessageNote(
  policyId: string,
  description: string,
  createdBy: string,
): PolicyNote {
  return {
    policyId,
    policyNoteTypeId: POLICY_MESSAGE_NOTE_TYPE_ID,
    description: description.trim(),
    createdWhen: new Date().toISOString(),
    createdBy,
  };
}

/** System informational note (type 1) — e.g. Policy Created. Not editable. */
export function createInformationalNote(
  policyId: string,
  description: string,
  createdBy: string,
): PolicyNote {
  return {
    policyId,
    policyNoteTypeId: POLICY_INFORMATIONAL_NOTE_TYPE_ID,
    description: description.trim(),
    createdWhen: new Date().toISOString(),
    createdBy,
  };
}

/** Newest-first for Policy Notes UI. */
export function sortPolicyNotesDescending(
  notes: PolicyNote[] | undefined,
): PolicyNote[] {
  if (!notes?.length) return [];
  return [...notes].sort((a, b) => b.createdWhen.localeCompare(a.createdWhen));
}
