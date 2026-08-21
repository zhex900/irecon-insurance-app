import type { RefObject } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { useFetcher } from "react-router";
import { toast } from "sonner";

import type { Policy, PremiumBreakdown } from "~/lib/db/types";
import { focusFormIssue } from "~/lib/form-validation-ui";
import { getTakenStatusErrors } from "~/lib/policies/taken-status";
import { rollupPremiumTotals } from "~/lib/pricing/premium-totals";
import {
  type CarPolicyFormValues,
  carPolicyPricingSchema,
  POLICY_STATUS,
  wizardStepFields,
} from "~/lib/zod/policy-car";

import { INTENTS, SECTION_IDS } from "../../shared/constants";
import {
  PRICING_CONFIRMATION_STEP,
  rememberFocusSection,
  rememberWizardStep,
} from "../../wizard-step-memory";
import type { PolicyLeaveApi } from "../draft/use-draft-types";
import type { PolicyWizardActionData } from "./use-premium-calc";

export type WizardIssueFocus = {
  form: UseFormReturn<CarPolicyFormValues>;
  step: number;
  firstIssuePath: (fieldOrder?: string[]) => string | null;
  findStepForField: (path: string) => number | null;
  pendingFocusPathRef: RefObject<string | null>;
  goToStep: (index: number, options?: { unlock?: boolean }) => void;
};

export function focusFirstWizardIssue(focus: WizardIssueFocus): void {
  const allFields = Object.values(wizardStepFields).flat().map(String);
  const path = focus.firstIssuePath(allFields);
  if (!path) return;
  const targetStep = focus.findStepForField(path);
  if (targetStep != null && targetStep !== focus.step) {
    focus.pendingFocusPathRef.current = path;
    focus.goToStep(targetStep, { unlock: true });
    return;
  }
  focusFormIssue(focus.form.setFocus, path);
}

export function policyForDocumentConfirm(
  policy: Policy,
  values: CarPolicyFormValues,
): Policy {
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

export async function ensurePremiumForSubmit(options: {
  premium: PremiumBreakdown | undefined;
  fallbackPremium: PremiumBreakdown | undefined;
  form: UseFormReturn<CarPolicyFormValues>;
  policyId: string;
  setPremium: (premium: PremiumBreakdown | undefined) => void;
  setReferralReasons: (reasons: string[]) => void;
}): Promise<PremiumBreakdown | undefined | false> {
  const existing = options.premium ?? options.fallbackPremium;
  if (existing) return existing;
  const parsed = carPolicyPricingSchema.safeParse(options.form.getValues());
  if (!parsed.success) {
    return false;
  }
  const body = new FormData();
  body.set("intent", INTENTS.RECALCULATE);
  body.set("payload", JSON.stringify(parsed.data));
  const response = await fetch(`/policies/${options.policyId}`, {
    method: "post",
    body,
  });
  const data = (await response.json()) as PolicyWizardActionData;
  let premiumForDocs: PremiumBreakdown | undefined = existing;
  if (data.premium) {
    premiumForDocs = rollupPremiumTotals(data.premium);
    options.setPremium(premiumForDocs);
  }
  if (data.referralReasons) {
    options.setReferralReasons(data.referralReasons);
  }
  return premiumForDocs;
}

export function applyFormOverrides(
  form: UseFormReturn<CarPolicyFormValues>,
  overrides?: Partial<CarPolicyFormValues>,
): void {
  if (!overrides) return;
  for (const [key, value] of Object.entries(overrides)) {
    form.setValue(key as keyof CarPolicyFormValues, value, {
      shouldDirty: true,
      shouldValidate: false,
    });
  }
}

export function buildSavePayload(options: {
  form: UseFormReturn<CarPolicyFormValues>;
  overrides?: Partial<CarPolicyFormValues>;
  premium?: PremiumBreakdown;
}): string {
  return JSON.stringify({
    ...options.form.getValues(),
    ...options.overrides,
    ...(options.premium ? { premium: options.premium } : {}),
  });
}

type PolicySaveRefs = {
  savedSnapshotRef: RefObject<string>;
  hasUnsavedChangesRef: RefObject<boolean>;
  setHasUnsavedChanges: (value: boolean) => void;
  leave: PolicyLeaveApi | null;
};

export function markPolicySaveSucceeded(
  refs: PolicySaveRefs,
  payload: string,
): void {
  if (refs.leave) refs.leave.allowLeaveRef.current = true;
  refs.savedSnapshotRef.current = payload;
  refs.hasUnsavedChangesRef.current = false;
  refs.setHasUnsavedChanges(false);
}

export function submitPolicySave(
  fetcher: ReturnType<typeof useFetcher<PolicyWizardActionData>>,
  policyId: string,
  payload: string,
): void {
  const body = new FormData();
  body.set("intent", INTENTS.SAVE);
  body.set("payload", payload);
  fetcher.submit(body, {
    method: "post",
    action: `/policies/${policyId}`,
  });
}

export function parsePolicySaveResponse(
  data: PolicyWizardActionData | undefined,
):
  | { ok: true; data: PolicyWizardActionData & { policy: Policy } }
  | { ok: false; data?: PolicyWizardActionData } {
  if (!data || data.formError) return { ok: false, data };
  const fieldErrors = data.errors
    ? Object.entries(data.errors).flatMap(([field, messages]) =>
        (messages ?? []).map((msg) => `${field}: ${msg}`),
      )
    : [];
  if (fieldErrors.length > 0) return { ok: false, data };
  if (data.ok === true && data.policy) {
    return {
      ok: true,
      data: data as PolicyWizardActionData & { policy: Policy },
    };
  }
  return { ok: false, data };
}

/** Ignore stale fetcher.data from recalculate while waiting for a save response. */
export function isSaveActionResponse(
  data: PolicyWizardActionData | undefined,
): boolean {
  if (!data) return false;
  if (data.intent === "save") return true;
  if (data.formError) return true;
  if (
    data.errors &&
    Object.values(data.errors).some((messages) => (messages?.length ?? 0) > 0)
  ) {
    return true;
  }
  return false;
}

export function syncFormPolicyStatus(
  form: UseFormReturn<CarPolicyFormValues>,
  policyStatusId: number,
): void {
  if (Number(form.getValues("policyStatusId")) === policyStatusId) return;
  form.setValue("policyStatusId", policyStatusId, {
    shouldDirty: false,
    shouldValidate: false,
  });
}

export function reportPolicySaveFailure(
  data: PolicyWizardActionData | undefined,
): void {
  if (data?.formError) {
    toast.error(data.formError);
    return;
  }
  const fieldErrors = data?.errors
    ? Object.entries(data.errors).flatMap(([field, messages]) =>
        (messages ?? []).map((msg) => `${field}: ${msg}`),
      )
    : [];
  if (fieldErrors.length > 0) {
    toast.error("Please fix the following errors", {
      description: fieldErrors.slice(0, 5).join(" · "),
    });
    return;
  }
  toast.error("Could not save policy", {
    description: "Check your connection and try again.",
  });
}

export function rememberPremiumAfterSubmit(policyId: string): void {
  rememberWizardStep(
    policyId,
    PRICING_CONFIRMATION_STEP,
    PRICING_CONFIRMATION_STEP,
  );
  rememberFocusSection(policyId, SECTION_IDS.PREMIUM);
}

export function takenStatusBlocksSave(options: {
  statusId: number;
  form: UseFormReturn<CarPolicyFormValues>;
  premium: PremiumBreakdown | undefined;
  navigateToSection: (sectionId: string) => void;
}): boolean {
  if (options.statusId !== POLICY_STATUS.Taken) return false;
  const takenErrors = getTakenStatusErrors(options.form.getValues(), {
    contractWorksExistingStructurePremium:
      options.premium?.contractWorksExistingStructurePremium ?? 0,
    contractWorksPlantPremium: options.premium?.contractWorksPlantPremium ?? 0,
  });
  if (takenErrors.length === 0) return false;
  options.navigateToSection(SECTION_IDS.PREMIUM);
  return true;
}

export function clearPendingLeaveOnInvalid(leave: PolicyLeaveApi | null): void {
  if (!leave?.pendingLeaveAfterSaveRef.current) return;
  leave.pendingLeaveAfterSaveRef.current = false;
  leave.setPendingLeaveAfterSave(false);
}
