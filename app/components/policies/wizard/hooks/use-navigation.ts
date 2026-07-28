import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  POLICY_FORM_SECTIONS,
  sectionIdForStep,
  stepIndexForSection,
  usePolicySectionScrollSpy,
} from "~/components/policies/policy-form-layout";
import {
  flattenFieldErrors,
  focusFormIssue,
  orderFormIssues,
} from "~/lib/form-validation-ui";
import { labelForPolicyFieldPath } from "~/lib/policy-field-labels";
import {
  wizardStepFields,
  wizardSteps,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import type { PremiumBreakdown } from "~/lib/db/types";
import {
  PRICING_CONFIRMATION_STEP,
  readStoredMaxStep,
  readStoredStep,
  rememberWizardStep,
} from "../step-memory";

export function usePolicyWizardNavigation({
  policyId,
  form,
  readOnly,
  freshSteps,
  fieldsLocked,
  policyPremium,
  navIds,
}: {
  policyId: number;
  form: UseFormReturn<CarPolicyFormValues>;
  readOnly: boolean;
  freshSteps: boolean;
  fieldsLocked: boolean;
  policyPremium: PremiumBreakdown | null | undefined;
  navIds: string[];
}) {
  // Step is owned by module memory + sessionStorage. Never persist the mount
  // default (0) — that was wiping the remembered step on SSR remount.
  const [step, setStep] = useState(() =>
    freshSteps ? 0 : (readStoredStep(policyId) ?? 0),
  );
  const [maxStep, setMaxStep] = useState(() => {
    if (freshSteps) return 0;
    if (readOnly) return wizardSteps.length - 1;
    const remembered = readStoredStep(policyId) ?? 0;
    const unlockedByPremium = policyPremium
      ? PRICING_CONFIRMATION_STEP
      : remembered;
    return readStoredMaxStep(policyId, Math.max(remembered, unlockedByPremium));
  });

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries([
      ...POLICY_FORM_SECTIONS.map((s) => [s.id, true]),
      ["premium", true],
    ]),
  );
  const [activeSectionId, setActiveSectionId] =
    usePolicySectionScrollSpy(navIds);
  const pendingFocusPathRef = useRef<string | null>(null);

  // SSR renders step 0; restore remembered step before paint (read-only — do not write).
  // When policyId changes, re-derive from that policy — never carry over step/maxStep
  // from the previous policy. Skip when freshSteps: useState already started at 0.
  const lastNavRef = useRef<{
    policyId: number;
    readOnly: boolean;
    freshSteps: boolean;
    policyPremium: PremiumBreakdown | null | undefined;
  } | null>(null);
  useLayoutEffect(() => {
    const prev = lastNavRef.current;
    const changed =
      !prev ||
      prev.policyId !== policyId ||
      prev.readOnly !== readOnly ||
      prev.freshSteps !== freshSteps ||
      prev.policyPremium !== policyPremium;
    if (!changed) return;
    lastNavRef.current = { policyId, readOnly, freshSteps, policyPremium };
    const current = lastNavRef.current;
    if (current.freshSteps) return;
    if (current.readOnly) {
      setStep(readStoredStep(current.policyId) ?? 0);
      setMaxStep(wizardSteps.length - 1);
      return;
    }
    const storedStep = readStoredStep(current.policyId) ?? 0;
    setStep(storedStep);
    const unlockedByPremium = current.policyPremium
      ? PRICING_CONFIRMATION_STEP
      : storedStep;
    setMaxStep(
      readStoredMaxStep(
        current.policyId,
        Math.max(storedStep, unlockedByPremium),
      ),
    );
  }, [policyId, policyPremium, readOnly, freshSteps]);

  function firstIssuePath(fieldOrder?: string[]) {
    const issues = orderFormIssues(
      flattenFieldErrors(form.formState.errors),
      fieldOrder ?? [],
    );
    return issues[0]?.path ?? null;
  }

  function findStepForField(path: string): number | null {
    for (const [stepKey, fields] of Object.entries(wizardStepFields)) {
      if (
        fields.some((field) => path === field || path.startsWith(`${field}.`))
      ) {
        return Number(stepKey);
      }
    }
    return null;
  }

  function focusFirstIssue(fieldOrder?: string[]) {
    const path = firstIssuePath(fieldOrder);
    if (!path) return;
    focusFormIssue(form.setFocus, path);
  }

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

  function goToStep(index: number, { unlock = false } = {}) {
    if (index < 0 || index >= wizardSteps.length) return;
    if (!fieldsLocked && !unlock && index > maxStep) return;
    const nextMax = Math.max(maxStep, index);
    rememberWizardStep(policyId, index, nextMax);
    setStep(index);
    setMaxStep(nextMax);
    const sectionId = sectionIdForStep(index);
    setOpenMap((prev) => ({ ...prev, [sectionId]: true }));
    setActiveSectionId(sectionId);
    queueMicrotask(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function navigateToSection(sectionId: string) {
    if (sectionId !== "policy-information") {
      setOpenMap((prev) => ({ ...prev, [sectionId]: true }));
      const stepIndex = stepIndexForSection(sectionId);
      if (stepIndex != null) {
        const nextMax = Math.max(maxStep, stepIndex);
        rememberWizardStep(policyId, stepIndex, nextMax);
        setStep(stepIndex);
        setMaxStep(nextMax);
      }
    }
    setActiveSectionId(sectionId);
  }

  function navigateToIssue(path: string) {
    const targetStep = findStepForField(path);
    if (targetStep != null) {
      const sectionId = sectionIdForStep(targetStep);
      const nextMax = Math.max(maxStep, targetStep);
      rememberWizardStep(policyId, targetStep, nextMax);
      setStep(targetStep);
      setMaxStep(nextMax);
      setOpenMap((prev) => ({ ...prev, [sectionId]: true }));
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

  const fieldOrder = useMemo(
    () => Object.values(wizardStepFields).flat().map(String),
    [],
  );

  const invalidIssues = useMemo(() => {
    const issues = orderFormIssues(
      flattenFieldErrors(form.formState.errors),
      fieldOrder,
    );
    // Include any errors outside wizard step map (e.g. review status).
    const extras = flattenFieldErrors(form.formState.errors).filter(
      (issue) => !issues.some((ordered) => ordered.path === issue.path),
    );
    return [...issues, ...extras].map((issue) => ({
      path: issue.path,
      label: labelForPolicyFieldPath(issue.path),
      message: issue.message,
    }));
  }, [form.formState.errors, fieldOrder]);

  return {
    step,
    maxStep,
    openMap,
    setOpenMap,
    activeSectionId,
    setActiveSectionId,
    pendingFocusPathRef,
    goToStep,
    navigateToSection,
    navigateToIssue,
    firstIssuePath,
    findStepForField,
    focusFirstIssue,
    fieldOrder,
    invalidIssues,
  };
}
