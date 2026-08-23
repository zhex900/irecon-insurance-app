import type { UseFormReturn } from "react-hook-form";

import type { CarWording } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import type { usePolicyDocuments } from "../hooks/composite/use-documents";
import type { usePolicyDraftSave } from "../hooks/composite/use-draft-save";
import type { usePolicyLeaveGuard } from "../hooks/composite/use-leave-guard";
import type { usePolicyWizardNavigation } from "../hooks/composite/use-navigation";
import type { usePolicyPremiumCalc } from "../hooks/composite/use-premium-calc";
import type { usePolicySubmit } from "../hooks/composite/use-submit";
import type { useCarPolicyWizardSubmitGate } from "../hooks/utils/use-submit-gate";
import type { PolicyPhase } from "../shared/policy-phase";
import { policyPhaseCardBorderClass } from "../shared/policy-phase";
import type { useWizardCore, WizardStateProps } from "./use-wizard-core";

type DraftSave = ReturnType<typeof usePolicyDraftSave>;
type Submit = ReturnType<typeof usePolicySubmit>;
type Gate = ReturnType<typeof useCarPolicyWizardSubmitGate>;

export type WizardStateParts = {
  props: WizardStateProps;
  core: ReturnType<typeof useWizardCore>;
  navigation: ReturnType<typeof usePolicyWizardNavigation>;
  premiumCalc: ReturnType<typeof usePolicyPremiumCalc>;
  documents: ReturnType<typeof usePolicyDocuments>;
  draftSave: ReturnType<typeof usePolicyDraftSave>;
  submit: ReturnType<typeof usePolicySubmit>;
  leave: ReturnType<typeof usePolicyLeaveGuard>;
  gate: ReturnType<typeof useCarPolicyWizardSubmitGate>;
};

export function canChangeWizardStatus(phase: PolicyPhase): boolean {
  return phase === "pending";
}

export function createIssueAttentionHandlers(options: {
  form: UseFormReturn<CarPolicyFormValues>;
  markAttentionPaths: (paths: string[]) => void;
  navigateToIssue: (path: string) => void;
  navigateToSectionFirstIssue: (sectionId: string) => void;
  sectionIssuePaths: Record<string, string[]>;
}) {
  function handleSectionIssueCounter(sectionId: string) {
    options.navigateToSectionFirstIssue(sectionId);
    const paths = options.sectionIssuePaths[sectionId] ?? [];
    if (paths.length === 0) return;
    for (const path of paths) {
      options.form.clearErrors(path as keyof CarPolicyFormValues);
    }
    options.markAttentionPaths(paths);
  }

  function handleNavigateToIssue(path: string) {
    options.navigateToIssue(path);
    options.form.clearErrors(path as keyof CarPolicyFormValues);
    options.markAttentionPaths([path]);
  }

  return { handleSectionIssueCounter, handleNavigateToIssue };
}

export function buildPremiumPanelProps(
  parts: WizardStateParts,
  borderClassName: string,
  carWording: CarWording[],
) {
  const { props, premiumCalc, documents } = parts;
  return {
    premium: premiumCalc.premium,
    referralReasons: premiumCalc.referralReasons,
    isCalculating: premiumCalc.isCalculating,
    documents: documents.documents,
    isGeneratingDocuments: documents.isGeneratingDocuments,
    policyNumber: props.policy.policyNumber,
    clientName: props.clientName ?? "",
    reference: props.reference,
    policy: props.policy,
    getPreviewPolicy: documents.buildDocumentSnapshot,
    carWording,
    brokerFeeLines: props.reference.feeNames,
    className: borderClassName,
  };
}

export type PremiumPanelProps = ReturnType<typeof buildPremiumPanelProps>;
export type WizardDraftSlice = Pick<
  DraftSave,
  | "hasUnsavedChanges"
  | "hasUnsavedChangesRef"
  | "setHasUnsavedChanges"
  | "saveStatus"
  | "savedSnapshotRef"
  | "persistDraft"
  | "saveDraftNow"
  | "handleFieldBlur"
  | "setDraftSaveError"
>;
export type WizardSubmitSlice = Pick<
  Submit,
  | "submitConfirmOpen"
  | "submitting"
  | "submitDocumentNames"
  | "requestSubmit"
  | "confirmSubmit"
  | "savePolicy"
  | "confirmTerminalStatusAndSave"
> &
  Pick<Gate, "submitDisabled" | "setSubmittedFingerprint"> & {
    submitBusy: Submit["submitting"];
  };
export type WizardIssueHandlers = ReturnType<
  typeof createIssueAttentionHandlers
>;

export function wizardBorderClassName(
  parts: Pick<WizardStateParts, "core">,
): string {
  return policyPhaseCardBorderClass(parts.core.phase.phase);
}
