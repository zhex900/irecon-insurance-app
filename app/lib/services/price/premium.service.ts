import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import { POLICY_MESSAGE_NOTE_TYPE_ID, type PolicyNote } from "~/lib/db/types";
import { calculateCarPremium } from "~/server/pricing/car-calculator";
import { resolveBrokerFeeTotal } from "~/server/pricing/rate-resolver";
import { getReferenceData } from "~/lib/services/reference.service";

export async function calculatePremiumForPolicy(input: CarPolicyFormValues) {
  const reference = getReferenceData();
  const state = reference.states.find((item) => item.stateId === input.stateId);
  const stateCode = state?.code ?? "NSW";
  const brokerFeeTotal = await resolveBrokerFeeTotal(input.dateStart);

  return calculateCarPremium(input, stateCode, brokerFeeTotal);
}

export function buildReferralNotes(
  policyId: string,
  reasons: string[],
  createdBy: string,
): PolicyNote[] {
  if (reasons.length === 0) return [];
  return [
    {
      policyNoteId: Date.now(),
      policyId,
      policyNoteTypeId: 2,
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
      (note) => note.policyNoteTypeId === 2 && note.description === nextDesc,
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
    policyNoteId: Date.now(),
    policyId,
    policyNoteTypeId: POLICY_MESSAGE_NOTE_TYPE_ID,
    description: description.trim(),
    createdWhen: new Date().toISOString(),
    createdBy,
  };
}
