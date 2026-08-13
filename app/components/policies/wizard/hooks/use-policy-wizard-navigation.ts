import { type UseFormReturn } from "react-hook-form";
import { focusFormIssue, orderFormIssues } from "~/lib/form-validation-ui";
import { flattenFieldErrors } from "~/lib/form-validation-ui";
import { labelForPolicyFieldPath } from "~/lib/policies/field-labels";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";
import type { PremiumBreakdown } from "~/lib/db/types";
import { SECTION_IDS } from "../constants";
import { useWizardStepManagement } from "./use-wizard-step-management";
import { useWizardSectionManagement } from "./use-wizard-section-management";
import { useWizardValidationState } from "./use-wizard-validation-state";
import { useWizardFocusManagement } from "./use-wizard-focus-management";
import { findStepForFieldPath } from "./use-wizard-navigation-utils";

export function usePolicyWizardNavigation({
  policyId,
  form,
  policyPremium,
  isDraft,
  navIds,
}: {
  policyId: string;
  form: UseFormReturn<CarPolicyFormValues>;
  policyPremium: PremiumBreakdown | null | undefined;
  /** Used to re-run post-submit focus after save revalidation. */
  isDraft: boolean;
  navIds: string[];
}) {
  // Step management
  const {
    step,
    maxStep,
    setStep,
    setMaxStep,
    goToStep: goToStepRaw,
    canNavigateToStep,
  } = useWizardStepManagement({
    policyId,
    policyPremium,
  });

  // Section management
  const {
    openMap,
    setOpenMap,
    activeSectionId,
    setActiveSectionId,
    navigateToSection: navigateToSectionRaw,
  } = useWizardSectionManagement({
    policyId,
    navIds,
    step,
    maxStep,
    setStep,
    setMaxStep,
  });

  // Validation state
  const {
    invalidIssues,
    sectionIssueCounts,
    sectionFirstIssuePaths,
    sectionIssuePaths,
    isFormValid,
    fieldOrder,
  } = useWizardValidationState({
    form,
  });

  // Focus management
  const {
    pendingFocusPathRef,
    navigateToIssue,
    navigateToSectionFirstIssue: navigateToSectionFirstIssueRaw,
  } = useWizardFocusManagement({
    policyId,
    form,
    isDraft,
    step,
    maxStep,
    setStep,
    setMaxStep,
    openMap,
    setOpenMap,
    activeSectionId,
    setActiveSectionId,
    navigateToSection: navigateToSectionRaw,
    findStepForField: findStepForFieldPath,
  });

  // Navigation functions
  function goToStep(index: number, { unlock = false } = {}) {
    const result = goToStepRaw(index, { unlock });
    if (!result) return;
    const { sectionId } = result;
    setOpenMap((prev) => ({ ...prev, [sectionId]: true }));
    setActiveSectionId(sectionId);
    queueMicrotask(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function navigateToSection(
    sectionId: string,
    { ensureOpen = true }: { ensureOpen?: boolean } = {},
  ) {
    return navigateToSectionRaw(sectionId, { ensureOpen });
  }

  function navigateToSectionFirstIssue(sectionId: string) {
    return navigateToSectionFirstIssueRaw(sectionId, sectionFirstIssuePaths);
  }

  // Utility functions
  function firstIssuePath(fieldOrderOverride?: string[]) {
    const issues = orderFormIssues(
      flattenFieldErrors(form.formState.errors),
      fieldOrderOverride ?? fieldOrder,
    );
    return issues[0]?.path ?? null;
  }

  function findStepForField(path: string): number | null {
    return findStepForFieldPath(path);
  }

  function focusFirstIssue(fieldOrderOverride?: string[]) {
    const path = firstIssuePath(fieldOrderOverride);
    if (!path) return;
    focusFormIssue(form.setFocus, path);
  }

  return {
    // State
    step,
    maxStep,
    openMap,
    setOpenMap,
    activeSectionId,
    setActiveSectionId,
    pendingFocusPathRef,
    
    // Navigation functions
    goToStep,
    navigateToSection,
    navigateToIssue,
    navigateToSectionFirstIssue,
    
    // Utility functions
    firstIssuePath,
    findStepForField,
    focusFirstIssue,
    
    // Validation state
    fieldOrder,
    invalidIssues,
    sectionIssueCounts,
    sectionFirstIssuePaths,
    sectionIssuePaths,
    isFormValid,
  };
}