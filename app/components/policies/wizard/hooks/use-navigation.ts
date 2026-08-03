import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
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
  carPolicySchema,
  wizardStepFields,
  wizardSteps,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import type { PremiumBreakdown } from "~/lib/db/types";
import {
  PRICING_CONFIRMATION_STEP,
  clearFocusSection,
  peekFocusSection,
  readStoredMaxStep,
  readStoredStep,
  rememberWizardStep,
} from "../step-memory";

function findStepForFieldPath(path: string): number | null {
  for (const [stepKey, fields] of Object.entries(wizardStepFields)) {
    if (
      fields.some((field) => path === field || path.startsWith(`${field}.`))
    ) {
      return Number(stepKey);
    }
  }
  return null;
}

export function usePolicyWizardNavigation({
  policyId,
  form,
  readOnly,
  freshSteps,
  fieldsLocked,
  policyPremium,
  isDraft,
  navIds,
}: {
  policyId: number;
  form: UseFormReturn<CarPolicyFormValues>;
  readOnly: boolean;
  freshSteps: boolean;
  fieldsLocked: boolean;
  policyPremium: PremiumBreakdown | null | undefined;
  /** Used to re-run post-submit focus after save revalidation. */
  isDraft: boolean;
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
    return findStepForFieldPath(path);
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

  function navigateToSection(
    sectionId: string,
    { ensureOpen = true }: { ensureOpen?: boolean } = {},
  ) {
    if (sectionId !== "policy-information") {
      if (ensureOpen) {
        setOpenMap((prev) => ({ ...prev, [sectionId]: true }));
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot after submit
  }, [policyId, isDraft]);

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

  // Live completeness for side-nav badges / Submit enablement (not only RHF errors).
  // Serialize for the memo dep — RHF may mutate the watch object in place.
  const watchedValues = useWatch({ control: form.control });
  const watchedKey = JSON.stringify(watchedValues);
  const {
    sectionIssueCounts,
    sectionFirstIssuePaths,
    sectionIssuePaths,
    isFormValid,
  } = useMemo(() => {
    const counts: Record<string, number> = {
      "policy-information": 0,
    };
    const firstPaths: Record<string, string> = {};
    const allPaths: Record<string, string[]> = {
      "policy-information": [],
    };
    for (const section of POLICY_FORM_SECTIONS) {
      counts[section.id] = 0;
      allPaths[section.id] = [];
    }

    const parsed = carPolicySchema.safeParse(watchedValues);
    if (parsed.success) {
      return {
        sectionIssueCounts: counts,
        sectionFirstIssuePaths: firstPaths,
        sectionIssuePaths: allPaths,
        isFormValid: true,
      };
    }

    const pathsBySection = new Map<string, Set<string>>();
    for (const issue of parsed.error.issues) {
      const path = issue.path.map(String).join(".");
      if (!path) continue;
      const stepIndex = findStepForFieldPath(path);
      if (stepIndex == null) continue;
      const sectionId = sectionIdForStep(stepIndex);
      let set = pathsBySection.get(sectionId);
      if (!set) {
        set = new Set();
        pathsBySection.set(sectionId, set);
      }
      set.add(path);
    }
    for (const [sectionId, paths] of pathsBySection) {
      const ordered = orderFormIssues(
        [...paths].map((path) => ({ path, message: "" })),
        fieldOrder,
      );
      const orderedPaths = ordered.map((item) => item.path);
      counts[sectionId] = paths.size;
      allPaths[sectionId] = orderedPaths;
      if (orderedPaths[0]) firstPaths[sectionId] = orderedPaths[0];
    }
    return {
      sectionIssueCounts: counts,
      sectionFirstIssuePaths: firstPaths,
      sectionIssuePaths: allPaths,
      isFormValid: false,
    };
    // watchedKey tracks deep edits; watchedValues used inside for parse.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [watchedKey, fieldOrder]);

  function navigateToSectionFirstIssue(sectionId: string) {
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
    navigateToSectionFirstIssue,
    firstIssuePath,
    findStepForField,
    focusFirstIssue,
    fieldOrder,
    invalidIssues,
    sectionIssueCounts,
    sectionFirstIssuePaths,
    sectionIssuePaths,
    isFormValid,
  };
}
