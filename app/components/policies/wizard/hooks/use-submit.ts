import { useState, type MutableRefObject } from "react";
import type { useFetcher } from "react-router";
import type { UseFormReturn } from "react-hook-form";
import { focusFormIssue } from "~/lib/form-validation-ui";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { listReviewDocumentsForConfirm } from "~/lib/services/policy/documents";
import {
  carPolicyPricingSchema,
  pricingFields,
  wizardStepFields,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import type { PolicyWizardActionData } from "./use-premium-calc";
import type { PolicyLeaveApi } from "./use-draft-save";

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
  goToStep,
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
  premiumRef: MutableRefObject<PremiumBreakdown | undefined>;
  setPremium: (premium: PremiumBreakdown | undefined) => void;
  setReferralReasons: (reasons: string[]) => void;
  regenerateDocumentsIfNeeded: (options?: {
    cancelled?: () => boolean;
    premiumOverride?: PremiumBreakdown;
  }) => Promise<void>;
  goToStep: (index: number, options?: { unlock?: boolean }) => void;
  firstIssuePath: (fieldOrder?: string[]) => string | null;
  findStepForField: (path: string) => number | null;
  pendingFocusPathRef: MutableRefObject<string | null>;
  getLeaveApi: () => PolicyLeaveApi | null;
  savedSnapshotRef: MutableRefObject<string>;
  hasUnsavedChangesRef: MutableRefObject<boolean>;
  setHasUnsavedChanges: (value: boolean) => void;
}) {
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submitDocumentNames = listReviewDocumentsForConfirm({
    ...policy,
    stateId: Number(form.watch("stateId")) || policy.stateId,
  });

  async function requestSubmit() {
    const valid = await form.trigger();
    if (!valid) {
      const allFields = Object.values(wizardStepFields).flat().map(String);
      const path = firstIssuePath(allFields);
      if (path) {
        const targetStep = findStepForField(path);
        if (targetStep != null && targetStep !== step) {
          pendingFocusPathRef.current = path;
          goToStep(targetStep, { unlock: true });
        } else {
          focusFormIssue(form.setFocus, path);
        }
      }
      return;
    }
    setSubmitConfirmOpen(true);
  }

  async function confirmSubmit() {
    setSubmitting(true);
    try {
      let premiumForDocs = premium ?? policy.car.premium;
      if (!premiumForDocs) {
        const parsed = carPolicyPricingSchema.safeParse(form.getValues());
        if (!parsed.success) {
          setSubmitConfirmOpen(false);
          await form.trigger([...pricingFields]);
          return;
        }
        const body = new FormData();
        body.set("intent", "recalculate");
        body.set("payload", JSON.stringify(parsed.data));
        const response = await fetch(`/policies/${policy.policyId}`, {
          method: "post",
          body,
        });
        const data = (await response.json()) as PolicyWizardActionData;
        if (data.premium) {
          setPremium(data.premium);
          premiumForDocs = data.premium;
        }
        if (data.referralReasons) {
          setReferralReasons(data.referralReasons);
        }
      }
      await regenerateDocumentsIfNeeded({
        premiumOverride: premiumForDocs,
      });
      await savePolicy();
      setSubmitConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function savePolicy(overrides?: Partial<CarPolicyFormValues>) {
    if (overrides) {
      for (const [key, value] of Object.entries(overrides)) {
        form.setValue(key as keyof CarPolicyFormValues, value as never, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    }
    const valid = await form.trigger();
    if (!valid) {
      const leave = getLeaveApi();
      if (leave?.pendingLeaveAfterSaveRef.current) {
        leave.pendingLeaveAfterSaveRef.current = false;
        leave.setPendingLeaveAfterSave(false);
      }
      const allFields = Object.values(wizardStepFields).flat().map(String);
      const path = firstIssuePath(allFields);
      if (path) {
        const targetStep = findStepForField(path);
        if (targetStep != null && targetStep !== step) {
          pendingFocusPathRef.current = path;
          goToStep(targetStep, { unlock: true });
        } else {
          focusFormIssue(form.setFocus, path);
        }
      }
      return false;
    }
    const leave = getLeaveApi();
    if (leave) leave.allowLeaveRef.current = true;
    const premiumOverride = premiumRef.current ?? premium;
    const values = {
      ...form.getValues(),
      ...overrides,
      ...(premiumOverride ? { premium: premiumOverride } : {}),
    };
    const payload = JSON.stringify(values);
    // Clear dirty state so leave navigation is not blocked after status save.
    savedSnapshotRef.current = payload;
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    const body = new FormData();
    body.set("intent", "save");
    body.set("payload", payload);
    fetcher.submit(body, {
      method: "post",
      action: `/policies/${policy.policyId}`,
    });
    return true;
  }

  /** Confirm Taken / Not taken and persist immediately (draft save is locked once terminal). */
  function confirmTerminalStatusAndSave(statusId: number) {
    form.setValue("policyStatusId", statusId, {
      shouldDirty: true,
      shouldValidate: false,
    });
    // Pass status explicitly — getValues() can still see the previous Pending value.
    // Generate Schedule + ROA (and library docs) with the confirmed status.
    void (async () => {
      await regenerateDocumentsIfNeeded();
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
