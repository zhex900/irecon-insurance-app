import { type RefObject, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { useFetcher } from "react-router";
import { toast } from "sonner";

import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { listReviewDocumentsForConfirmClient } from "~/lib/services/policy/documents/documents.client";
import {
  type CarPolicyFormValues,
  POLICY_STATUS,
  pricingFields,
} from "~/lib/zod/policy-car";

import type { RegenerateDocumentsOptions } from "../documents/document-utils";
import type { PolicyLeaveApi } from "../draft/use-draft-types";
import {
  applyFormOverrides,
  buildSavePayload,
  clearPendingLeaveOnInvalid,
  ensurePremiumForSubmit,
  focusFirstWizardIssue,
  policyForDocumentConfirm,
  rememberPremiumAfterSubmit,
  submitPolicySave,
  takenStatusBlocksSave,
} from "./submit-helpers";
import type { PolicyWizardActionData } from "./use-premium-calc";

export function usePolicySubmit({
  policy,
  form,
  fetcher,
  step,
  premium,
  premiumRef,
  setPremium,
  setReferralReasons,
  regenerateDocumentsIfNeeded,
  formDataChangedForDocuments,
  goToStep,
  navigateToSection,
  firstIssuePath,
  findStepForField,
  pendingFocusPathRef,
  getLeaveApi,
  savedSnapshotRef,
  hasUnsavedChangesRef,
  setHasUnsavedChanges,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  step: number;
  premium: PremiumBreakdown | undefined;
  premiumRef: RefObject<PremiumBreakdown | undefined>;
  setPremium: (premium: PremiumBreakdown | undefined) => void;
  setReferralReasons: (reasons: string[]) => void;
  regenerateDocumentsIfNeeded: (
    options?: RegenerateDocumentsOptions,
  ) => Promise<void>;
  formDataChangedForDocuments: (premiumOverride?: PremiumBreakdown) => boolean;
  goToStep: (index: number, options?: { unlock?: boolean }) => void;
  navigateToSection: (sectionId: string) => void;
  firstIssuePath: (fieldOrder?: string[]) => string | null;
  findStepForField: (path: string) => number | null;
  pendingFocusPathRef: RefObject<string | null>;
  getLeaveApi: () => PolicyLeaveApi | null;
  savedSnapshotRef: RefObject<string>;
  hasUnsavedChangesRef: RefObject<boolean>;
  setHasUnsavedChanges: (value: boolean) => void;
}) {
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitDocumentNames, setSubmitDocumentNames] = useState<string[]>([]);
  const issueFocus = {
    form,
    step,
    firstIssuePath,
    findStepForField,
    pendingFocusPathRef,
    goToStep,
  };

  async function requestSubmit() {
    const valid = await form.trigger();
    if (!valid) {
      focusFirstWizardIssue(issueFocus);
      return;
    }
    try {
      const names = await listReviewDocumentsForConfirmClient(
        policyForDocumentConfirm(policy, form.getValues()),
      );
      setSubmitDocumentNames(names);
    } catch {
      setSubmitDocumentNames([]);
      toast.error("Could not load document list", {
        description: "Check your connection and try again.",
      });
      return;
    }
    setSubmitConfirmOpen(true);
  }

  async function confirmSubmit() {
    setSubmitting(true);
    try {
      const premiumForDocs = await ensurePremiumForSubmit({
        premium,
        fallbackPremium: policy.car.premium,
        form,
        policyId: policy.policyId,
        setPremium,
        setReferralReasons,
      });
      if (premiumForDocs === false) {
        setSubmitConfirmOpen(false);
        await form.trigger([...pricingFields]);
        return false;
      }
      await regenerateDocumentsIfNeeded({
        premiumOverride: premiumForDocs,
        force: true,
      });
      const saved = await savePolicy();
      setSubmitConfirmOpen(false);
      if (saved !== false) rememberPremiumAfterSubmit(policy.policyId);
      return saved !== false;
    } finally {
      setSubmitting(false);
    }
  }

  async function savePolicy(overrides?: Partial<CarPolicyFormValues>) {
    applyFormOverrides(form, overrides);
    const valid = await form.trigger();
    if (!valid) {
      clearPendingLeaveOnInvalid(getLeaveApi());
      focusFirstWizardIssue(issueFocus);
      return false;
    }
    submitPolicySave({
      fetcher,
      policyId: policy.policyId,
      payload: buildSavePayload({
        form,
        overrides,
        premium: premiumRef.current ?? premium,
      }),
      savedSnapshotRef,
      hasUnsavedChangesRef,
      setHasUnsavedChanges,
      leave: getLeaveApi(),
    });
    return true;
  }

  function confirmTerminalStatusAndSave(statusId: number) {
    const currentPremium = premiumRef.current ?? premium;
    if (
      takenStatusBlocksSave({
        statusId,
        form,
        premium: currentPremium,
        navigateToSection,
      })
    ) {
      return;
    }
    const formChanged =
      hasUnsavedChangesRef.current ||
      formDataChangedForDocuments(currentPremium);
    form.setValue("policyStatusId", statusId, {
      shouldDirty: true,
      shouldValidate: false,
    });
    void (async () => {
      if (statusId === POLICY_STATUS.Taken && formChanged) {
        await regenerateDocumentsIfNeeded({
          premiumOverride: currentPremium,
          force: true,
        });
      }
      await savePolicy({ policyStatusId: statusId });
    })();
  }

  return {
    submitConfirmOpen,
    setSubmitConfirmOpen,
    submitting,
    submitDocumentNames,
    requestSubmit,
    confirmSubmit,
    savePolicy,
    confirmTerminalStatusAndSave,
  };
}
