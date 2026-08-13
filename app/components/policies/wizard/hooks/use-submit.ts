import { useState, type RefObject } from "react";
import type { useFetcher } from "react-router";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { focusFormIssue } from "~/lib/form-validation-ui";
import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { rollupPremiumTotals } from "~/lib/pricing/premium-totals";
import { getTakenStatusErrors } from "~/lib/policies/taken-status";
import { listReviewDocumentsForConfirmClient } from "~/lib/services/policy/documents/documents.client";
import {
  carPolicyPricingSchema,
  POLICY_STATUS,
  pricingFields,
  wizardStepFields,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import {
  PRICING_CONFIRMATION_STEP,
  rememberFocusSection,
  rememberWizardStep,
} from "../step-memory";
import type { PolicyWizardActionData } from "./use-premium-calc";
import type { PolicyLeaveApi } from "./use-draft-save";
import { INTENTS, SECTION_IDS } from "../constants";

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
  regenerateDocumentsIfNeeded: (options?: {
    cancelled?: () => boolean;
    premiumOverride?: PremiumBreakdown;
    force?: boolean;
    replaceCoverPack?: boolean;
  }) => Promise<void>;
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

  function policyForDocumentConfirm(): Policy {
    const values = form.getValues();
    const coverTypeId = Number(values.coverTypeId) || policy.car.coverTypeId;
    return {
      ...policy,
      stateId: Number(values.stateId) || policy.stateId,
      car: {
        ...policy.car,
        coverTypeId,
        annualCoverTypeId:
          coverTypeId === 1
            ? Number(values.annualCoverTypeId) || policy.car.annualCoverTypeId
            : null,
      },
    };
  }

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

    try {
      const names = await listReviewDocumentsForConfirmClient(
        policyForDocumentConfirm(),
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
      let premiumForDocs = premium ?? policy.car.premium;
      if (!premiumForDocs) {
        const parsed = carPolicyPricingSchema.safeParse(form.getValues());
        if (!parsed.success) {
          setSubmitConfirmOpen(false);
          await form.trigger([...pricingFields]);
          return false;
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
          const rolled = rollupPremiumTotals(data.premium);
          setPremium(rolled);
          premiumForDocs = rolled;
        }
        if (data.referralReasons) {
          setReferralReasons(data.referralReasons);
        }
      }
      await regenerateDocumentsIfNeeded({
        premiumOverride: premiumForDocs,
        // Confirming generation is an explicit document event: retain the
        // previous PDFs and append the newly generated pack as the next version
        // (unless cover type changed — ensureReviewDocumentsClient replaces).
        force: true,
      });
      const saved = await savePolicy();
      setSubmitConfirmOpen(false);
      if (saved !== false) {
        // Land on Premium after the save redirect/revalidation.
        rememberWizardStep(
          policy.policyId,
          PRICING_CONFIRMATION_STEP,
          PRICING_CONFIRMATION_STEP,
        );
        rememberFocusSection(policy.policyId, SECTION_IDS.PREMIUM);
      }
      return saved !== false;
    } finally {
      setSubmitting(false);
    }
  }

  async function savePolicy(overrides?: Partial<CarPolicyFormValues>) {
    if (overrides) {
      for (const [key, value] of Object.entries(overrides)) {
        form.setValue(key as keyof CarPolicyFormValues, value, {
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
    body.set("intent", INTENTS.SAVE);
    body.set("payload", payload);
    fetcher.submit(body, {
      method: "post",
      action: `/policies/${policy.policyId}`,
    });
    return true;
  }

  /** Confirm Taken / Not taken and persist immediately (draft save is locked once terminal). */
  function confirmTerminalStatusAndSave(statusId: number) {
    // Menu validates Taken first; keep a hard stop here if confirm is invoked anyway.
    if (statusId === POLICY_STATUS.Taken) {
      const values = form.getValues();
      const currentPremium = premiumRef.current ?? premium;
      const takenErrors = getTakenStatusErrors(values, {
        contractWorksExistingStructurePremium:
          currentPremium?.contractWorksExistingStructurePremium ?? 0,
        contractWorksPlantPremium:
          currentPremium?.contractWorksPlantPremium ?? 0,
      });
      if (takenErrors.length > 0) {
        navigateToSection(SECTION_IDS.PREMIUM);
        return;
      }
    }

    // Detect content changes before flipping status (status alone is not in PDF fields).
    const premiumOverride = premiumRef.current ?? premium;
    const formChanged =
      hasUnsavedChangesRef.current ||
      formDataChangedForDocuments(premiumOverride);

    form.setValue("policyStatusId", statusId, {
      shouldDirty: true,
      shouldValidate: false,
    });
    // Pass status explicitly — getValues() can still see the previous Pending value.
    // On Taken: regenerate Schedule/ROA when form/premium changed (or no review docs yet).
    void (async () => {
      if (statusId === POLICY_STATUS.Taken && formChanged) {
        await regenerateDocumentsIfNeeded({
          premiumOverride,
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
