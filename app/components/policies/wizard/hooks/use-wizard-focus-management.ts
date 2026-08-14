import { useEffect, useRef } from "react";
import { type UseFormReturn } from "react-hook-form";
import { focusFormIssue } from "~/lib/form-validation-ui";
import {
  rememberWizardStep,
  clearFocusSection,
  peekFocusSection,
} from "../step-memory";
import { sectionIdForStep } from "./use-wizard-navigation-utils";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

export function useWizardFocusManagement({
  policyId,
  form,
  isDraft,
  step: _step,
  maxStep,
  setStep,
  setMaxStep,
  openMap,
  setOpenMap,
  activeSectionId,
  setActiveSectionId,
  navigateToSection,
  findStepForField,
}: {
  policyId: string;
  form: UseFormReturn<CarPolicyFormValues>;
  isDraft: boolean;
  step: number;
  maxStep: number;
  setStep: (step: number) => void;
  setMaxStep: (maxStep: number) => void;
  openMap: Record<string, boolean>;
  setOpenMap: (
    map:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  activeSectionId: string;
  setActiveSectionId: (sectionId: string) => void;
  navigateToSection: (
    sectionId: string,
    options?: { ensureOpen?: boolean },
  ) => void;
  findStepForField: (path: string) => number | null;
}) {
  const pendingFocusPathRef = useRef<string | null>(null);

  // Focus after navigating to a section that needed opening/expanding.
  useEffect(() => {
    const path = pendingFocusPathRef.current;
    if (!path) return;
    pendingFocusPathRef.current = null;
    // Wait a frame so collapsible panels can mount/expand before focusing.
    const frame = requestAnimationFrame(() => {
      focusFormIssue(form.setFocus, path);
    });
    return () => cancelAnimationFrame(frame);
  }, [form.setFocus, activeSectionId, openMap]);

  // After submit redirect/revalidation, open and scroll to Premium once.
  useEffect(() => {
    const sectionId = peekFocusSection(policyId);
    if (!sectionId) return;
    const frame = requestAnimationFrame(() => {
      navigateToSection(sectionId);
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      clearFocusSection(policyId);
    });
    return () => cancelAnimationFrame(frame);
    // Re-run when draft clears after submit (same URL revalidation) or remount.
  }, [
    policyId,
    isDraft,
    navigateToSection,
  ]);

  function navigateToIssue(path: string) {
    const targetStep = findStepForField(path);
    if (targetStep != null) {
      const sectionId = sectionIdForStep(targetStep);
      const nextMax = Math.max(maxStep, targetStep);
      rememberWizardStep(policyId, targetStep, nextMax);
      setStep(targetStep);
      setMaxStep(nextMax);
      setOpenMap((prev: Record<string, boolean>) => ({
        ...prev,
        [sectionId]: true,
      }));
      setActiveSectionId(sectionId);
    }

    // Always focus — don't rely on activeSectionId changing (same-section
    // clicks would otherwise no-op via the pending-focus effect alone).
    pendingFocusPathRef.current = path;
    const focus = () => focusFormIssue(form.setFocus, path);
    requestAnimationFrame(() => {
      requestAnimationFrame(focus);
    });
    // Retry after collapsible height transition (~200ms).
    window.setTimeout(() => {
      focus();
      if (pendingFocusPathRef.current === path) {
        pendingFocusPathRef.current = null;
      }
    }, 250);
  }

  function navigateToSectionFirstIssue(
    sectionId: string,
    sectionFirstIssuePaths: Record<string, string>,
  ) {
    const path = sectionFirstIssuePaths[sectionId];
    if (path) {
      // Yellow attention border — do not trigger RHF errors (red invalid).
      navigateToIssue(path);
      return path;
    }
    navigateToSection(sectionId);
    return null;
  }

  return {
    pendingFocusPathRef,
    navigateToIssue,
    navigateToSectionFirstIssue,
  };
}
