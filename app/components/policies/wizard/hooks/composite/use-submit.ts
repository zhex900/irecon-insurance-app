import { type RefObject, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { useFetcher } from "react-router";
import { toast } from "sonner";

import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { listReviewDocumentsForConfirmClient } from "~/lib/services/policy/documents/documents.client";
import {
  type CarPolicyFormValues,
  carPolicyPricingSchema,
  POLICY_STATUS,
  pricingFields,
} from "~/lib/zod/policy-car";

import type { RegenerateDocumentsOptions } from "../documents/document-utils";
import type { PolicyLeaveApi } from "../draft/use-draft-types";
import {
  applyFormOverrides,
  buildSavePayload,
  clearPendingLeaveOnInvalid,
  focusFirstWizardIssue,
  isSaveActionResponse,
  markPolicySaveSucceeded,
  parsePolicySaveResponse,
  policyForDocumentConfirm,
  rememberPremiumAfterSubmit,
  reportPolicySaveFailure,
  submitPolicySave,
  syncFormPolicyStatus,
  takenStatusBlocksSave,
} from "./submit-helpers";
import type { PolicyWizardActionData } from "./use-premium-calc";

type SaveWaiter = (result: ReturnType<typeof parsePolicySaveResponse>) => void;

export function usePolicySubmit({
  policy,
  form,
  fetcher,
  step,
  premium,
  premiumRef,
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
  cancelQueuedDraftSave,
  waitForDraftIdle,
}: {
  policy: Policy;
  form: UseFormReturn<CarPolicyFormValues>;
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>;
  step: number;
  premium: PremiumBreakdown | undefined;
  premiumRef: RefObject<PremiumBreakdown | undefined>;
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
  cancelQueuedDraftSave: () => void;
  waitForDraftIdle: () => Promise<void>;
}) {
  const saveWaitRef = useRef<SaveWaiter | null>(null);
  const saveSawBusyRef = useRef(false);
  const confirmSaveStartedRef = useRef(false);

  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitConfirmLoading, setSubmitConfirmLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [terminalStatusSaving, setTerminalStatusSaving] = useState(false);
  const [submitDocumentNames, setSubmitDocumentNames] = useState<string[]>([]);
  const issueFocus = {
    form,
    step,
    firstIssuePath,
    findStepForField,
    pendingFocusPathRef,
    goToStep,
  };

  useEffect(() => {
    if (!saveWaitRef.current) {
      saveSawBusyRef.current = false;
      return;
    }
    if (fetcher.state !== "idle") {
      saveSawBusyRef.current = true;
      return;
    }
    if (!saveSawBusyRef.current) return;
    if (!isSaveActionResponse(fetcher.data)) return;

    saveSawBusyRef.current = false;
    const resolve = saveWaitRef.current;
    saveWaitRef.current = null;
    resolve(parsePolicySaveResponse(fetcher.data));
  }, [fetcher.state, fetcher.data]);

  // Close after confirm finishes — same pattern as policy status menu.
  useEffect(() => {
    if (!submitConfirmOpen) {
      confirmSaveStartedRef.current = false;
      return;
    }
    if (submitting) return;
    if (!confirmSaveStartedRef.current) return;
    confirmSaveStartedRef.current = false;
    setSubmitConfirmOpen(false);
  }, [submitConfirmOpen, submitting]);

  function saveRefs() {
    return {
      savedSnapshotRef,
      hasUnsavedChangesRef,
      setHasUnsavedChanges,
      leave: getLeaveApi(),
    };
  }

  function waitForSaveResult(): Promise<
    ReturnType<typeof parsePolicySaveResponse>
  > {
    return new Promise((resolve) => {
      saveWaitRef.current = resolve;
    });
  }

  async function quiesceDraftSaves() {
    cancelQueuedDraftSave();
    await waitForDraftIdle();
  }

  /** Premium must already be on the client (Premium Summary open / calculated). */
  function resolvePremiumForSubmit(): PremiumBreakdown | false {
    const existing = premiumRef.current ?? premium ?? policy.car.premium;
    if (existing) return existing;

    const parsed = carPolicyPricingSchema.safeParse(form.getValues());
    if (!parsed.success) return false;

    toast.error("Premium not calculated yet", {
      description: "Open Premium Summary, wait for totals, then submit.",
    });
    return false;
  }

  async function requestSubmit() {
    if (submitConfirmOpen || submitConfirmLoading || submitting) return;
    const valid = await form.trigger();
    if (!valid) {
      focusFirstWizardIssue(issueFocus);
      return;
    }
    setSubmitConfirmLoading(true);
    try {
      const names = await listReviewDocumentsForConfirmClient(
        policyForDocumentConfirm(policy, form.getValues()),
      );
      setSubmitDocumentNames(names);
      setSubmitConfirmOpen(true);
    } catch {
      setSubmitDocumentNames([]);
      toast.error("Could not load document list", {
        description: "Check your connection and try again.",
      });
    } finally {
      setSubmitConfirmLoading(false);
    }
  }

  async function confirmSubmit() {
    if (submitting) return false;
    confirmSaveStartedRef.current = true;
    setSubmitting(true);
    try {
      await quiesceDraftSaves();
      const premiumForDocs = resolvePremiumForSubmit();
      if (premiumForDocs === false) {
        await form.trigger([...pricingFields]);
        if (carPolicyPricingSchema.safeParse(form.getValues()).success) {
          return false;
        }
        toast.error("Complete the pricing fields before submitting.");
        return false;
      }
      await regenerateDocumentsIfNeeded({
        premiumOverride: premiumForDocs,
        force: true,
      });
      const saved = await savePolicy();
      if (saved) rememberPremiumAfterSubmit(policy.policyId);
      return saved;
    } catch (error) {
      toast.error("Could not submit policy", {
        description:
          error instanceof Error
            ? error.message
            : "Check your connection and try again.",
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function savePolicy(
    overrides?: Partial<CarPolicyFormValues>,
  ): Promise<boolean> {
    const valid = await form.trigger();
    if (!valid) {
      clearPendingLeaveOnInvalid(getLeaveApi());
      focusFirstWizardIssue(issueFocus);
      return false;
    }

    await quiesceDraftSaves();

    const payload = buildSavePayload({
      form,
      overrides,
      premium: premiumRef.current ?? premium,
    });

    const resultPromise = waitForSaveResult();
    submitPolicySave(fetcher, policy.policyId, payload);
    const result = await resultPromise;

    if (!result.ok) {
      reportPolicySaveFailure(result.data);
      if (result.data?.errors) {
        focusFirstWizardIssue(issueFocus);
      }
      return false;
    }

    markPolicySaveSucceeded(saveRefs(), payload);
    applyFormOverrides(form, overrides);
    syncFormPolicyStatus(form, result.data.policy.policyStatusId);
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

    void (async () => {
      setTerminalStatusSaving(true);
      try {
        if (statusId === POLICY_STATUS.Taken && formChanged) {
          await quiesceDraftSaves();
          await regenerateDocumentsIfNeeded({
            premiumOverride: currentPremium,
            force: true,
          });
        }
        await savePolicy({ policyStatusId: statusId });
      } finally {
        setTerminalStatusSaving(false);
      }
    })();
  }

  const submitBlocked = submitConfirmOpen || submitConfirmLoading || submitting;

  return {
    submitConfirmOpen,
    submitConfirmLoading,
    submitBlocked,
    dismissSubmitConfirm: () => setSubmitConfirmOpen(false),
    submitting,
    terminalStatusSaving,
    submitDocumentNames,
    requestSubmit,
    confirmSubmit,
    savePolicy,
    confirmTerminalStatusAndSave,
  };
}
