import type { Policy } from "~/lib/db/types";
import { isTerminalStatus, POLICY_STATUS } from "~/lib/zod/policy-car";

/** Single lifecycle phase for wizard UI and edit gates. */
export type PolicyPhase = "new" | "pending" | "taken" | "not-taken";

export function derivePolicyPhase(
  policy: Policy,
  isNew: boolean,
  formStatusId?: number,
): PolicyPhase {
  const savedStatus = policy.policyStatusId;
  if (isTerminalStatus(savedStatus)) {
    return savedStatus === POLICY_STATUS.Taken ? "taken" : "not-taken";
  }

  const liveStatus = formStatusId ?? savedStatus;
  if (isTerminalStatus(liveStatus)) {
    return liveStatus === POLICY_STATUS.Taken ? "taken" : "not-taken";
  }

  if (policy.isDraft && (isNew || !policy.car.premium)) {
    return "new";
  }

  return "pending";
}

export function policyPhaseHeaderClass(phase: PolicyPhase): string {
  if (phase === "new") {
    return "border-l-4 border-l-primary bg-primary/[0.06]";
  }
  if (phase === "pending") {
    return "border-l-4 border-l-warning bg-warning/[0.1]";
  }
  if (phase === "taken") {
    return "border-l-4 border-l-success bg-success/[0.08]";
  }
  return "border-l-4 border-l-muted-foreground/40 bg-muted/20";
}

export function policyPhaseCardBorderClass(phase: PolicyPhase): string {
  if (phase === "new") {
    return "border border-border border-l-4 border-l-primary";
  }
  if (phase === "pending") {
    return "border border-border border-l-4 border-l-warning";
  }
  if (phase === "taken") {
    return "border border-border border-l-4 border-l-success";
  }
  return "border border-border border-l-4 border-l-muted-foreground/40";
}

export function isEditablePhase(phase: PolicyPhase): boolean {
  return phase === "new" || phase === "pending";
}
