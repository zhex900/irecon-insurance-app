import type { Policy } from "~/lib/db/types";

export function reviewDocumentsFingerprint(policy: Policy): string {
  const premium = policy.car.premium;
  return [
    policy.policyNumber,
    policy.policyStatusId,
    policy.car.estimatedTurnover,
    policy.car.contractWorksSumInsured,
    policy.stateId,
    premium?.originalTotalPremium ?? "none",
    premium?.contractWorksTotalPremium ?? "none",
    premium?.liabilityTotalPremium ?? "none",
  ].join("|");
}

export function adjustmentDocumentsFingerprint(policy: Policy): string {
  const adj = policy.car.adjustment;
  return [
    "adjustment",
    policy.policyNumber,
    adj?.adjustedTurnover ?? "none",
    adj?.adjustedTotalPremium ?? "none",
    adj?.stampDutyExempt ? "exempt" : "liable",
    adj?.adjustedDate ?? "none",
  ].join("|");
}
