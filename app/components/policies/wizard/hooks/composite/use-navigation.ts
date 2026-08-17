import { useCallback } from "react";
import { type UseFormReturn } from "react-hook-form";

import type { PremiumBreakdown } from "~/lib/db/types";
import {
  flattenFieldErrors,
  focusFormIssue,
  orderFormIssues,
} from "~/lib/form-validation-ui";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import { useWizardFocusManagement } from "../wizard/use-wizard-focus";
import { findStepForFieldPath } from "../wizard/use-wizard-navigation-utils";
import { useWizardSectionManagement } from "../wizard/use-wizard-sections";
import { useWizardStepManagement } from "../wizard/use-wizard-steps";
import { useWizardValidationState } from "../wizard/use-wizard-validation-state";

export function usePolicyWizardNavigation({
  policyId,
  form,
  values,
  policyPremium,
  isDraft,
  navIds,
}: {
  policyId: string;
  form: UseFormReturn<CarPolicyFormValues>;
  values: CarPolicyFormValues;
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
    canNavigateToStep: _canNavigateToStep,
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
    values,
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
  const goToStep = useCallback(
    function goToStep(index: number, { unlock = false } = {}) {
      const result = goToStepRaw(index, { unlock });
      if (!result) return;
      const { sectionId } = result;
      setOpenMap((prev: Record<string, boolean>) => ({
        ...prev,
        [sectionId]: true,
      }));
      setActiveSectionId(sectionId);
      queueMicrotask(() => {
        document.getElementById(sectionId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
    [goToStepRaw, setActiveSectionId, setOpenMap],
  );

  const navigateToSection = useCallback(
    function navigateToSection(
      sectionId: string,
      { ensureOpen = true }: { ensureOpen?: boolean } = {},
    ) {
      return navigateToSectionRaw(sectionId, { ensureOpen });
    },
    [navigateToSectionRaw],
  );

  const navigateToSectionFirstIssue = useCallback(
    function navigateToSectionFirstIssue(sectionId: string) {
      return navigateToSectionFirstIssueRaw(sectionId, sectionFirstIssuePaths);
    },
    [navigateToSectionFirstIssueRaw, sectionFirstIssuePaths],
  );

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
