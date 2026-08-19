import { useMemo } from "react";
import type { FieldErrors, UseFormReturn } from "react-hook-form";

import { POLICY_FORM_SECTIONS } from "~/components/policies/policy-form-layout";
import { flattenFieldErrors, orderFormIssues } from "~/lib/form-validation-ui";
import { labelForPolicyFieldPath } from "~/lib/policies/field-labels";
import {
  type CarPolicyFormValues,
  carPolicySchema,
  getPolicyRuleIssues,
  wizardStepFields,
} from "~/lib/zod/policy-car";

import { SECTION_IDS } from "../../shared/constants";
import {
  findStepForFieldPath,
  sectionIdForStep,
} from "./use-wizard-navigation-utils";

export const WIZARD_FIELD_ORDER = Object.values(wizardStepFields)
  .flat()
  .map(String);

export type WizardValidationIssue = {
  path: string;
  label: string;
  message: string;
};

export type WizardValidationState = {
  invalidIssues: WizardValidationIssue[];
  sectionIssueCounts: Record<string, number>;
  sectionFirstIssuePaths: Record<string, string>;
  sectionIssuePaths: Record<string, string[]>;
  isFormValid: boolean;
};

function emptySectionMaps() {
  const counts: Record<string, number> = {
    [SECTION_IDS.POLICY_INFORMATION]: 0,
  };
  const firstPaths: Record<string, string> = {};
  const allPaths: Record<string, string[]> = {
    [SECTION_IDS.POLICY_INFORMATION]: [],
  };
  for (const section of POLICY_FORM_SECTIONS) {
    counts[section.id] = 0;
    allPaths[section.id] = [];
  }
  return { counts, firstPaths, allPaths };
}

function addPathToSection(
  path: string,
  pathsBySection: Map<string, Set<string>>,
) {
  const stepIndex = findStepForFieldPath(path);
  if (stepIndex == null) return;
  const sectionId = sectionIdForStep(stepIndex);
  let set = pathsBySection.get(sectionId);
  if (!set) {
    set = new Set();
    pathsBySection.set(sectionId, set);
  }
  set.add(path);
}

export function computeWizardValidationState(
  values: CarPolicyFormValues,
  rhfErrors: FieldErrors<CarPolicyFormValues>,
  fieldOrder: string[] = WIZARD_FIELD_ORDER,
): WizardValidationState {
  const { counts, firstPaths, allPaths } = emptySectionMaps();
  const parsed = carPolicySchema.safeParse(values);
  const rhfIssues = flattenFieldErrors(rhfErrors);
  const rhfByPath = new Map(rhfIssues.map((issue) => [issue.path, issue]));

  if (parsed.success) {
    const extras = orderFormIssues(rhfIssues, fieldOrder);
    const leftover = rhfIssues.filter(
      (issue) => !extras.some((ordered) => ordered.path === issue.path),
    );
    return {
      invalidIssues: [...extras, ...leftover].map((issue) => ({
        path: issue.path,
        label: labelForPolicyFieldPath(issue.path),
        message: issue.message,
      })),
      sectionIssueCounts: counts,
      sectionFirstIssuePaths: firstPaths,
      sectionIssuePaths: allPaths,
      isFormValid: true,
    };
  }

  const messageByPath = new Map<string, string>();
  const pathsBySection = new Map<string, Set<string>>();
  for (const issue of parsed.error.issues) {
    const path = issue.path.map(String).join(".");
    if (!path) continue;
    if (!messageByPath.has(path)) {
      messageByPath.set(path, issue.message);
    }
    addPathToSection(path, pathsBySection);
  }
  // Zod skips superRefine when preprocess fields return undefined (empty
  // money/boolean selects). Always merge cross-field rules for the nav.
  for (const issue of getPolicyRuleIssues(values)) {
    const path = issue.path.map(String).join(".");
    if (!path || messageByPath.has(path)) continue;
    messageByPath.set(path, issue.message);
    addPathToSection(path, pathsBySection);
  }
  for (const [sectionId, paths] of pathsBySection) {
    const ordered = orderFormIssues(
      [...paths].map((path) => ({
        path,
        message: messageByPath.get(path) ?? "",
      })),
      fieldOrder,
    );
    const orderedPaths = ordered.map((item) => item.path);
    counts[sectionId] = paths.size;
    allPaths[sectionId] = orderedPaths;
    if (orderedPaths[0]) firstPaths[sectionId] = orderedPaths[0];
  }

  const orderedSchemaIssues = orderFormIssues(
    [...messageByPath.entries()].map(([path, message]) => ({
      path,
      message,
    })),
    fieldOrder,
  );
  const unorderedSchemaIssues = [...messageByPath.entries()]
    .filter(
      ([path]) => !orderedSchemaIssues.some((issue) => issue.path === path),
    )
    .map(([path, message]) => ({ path, message }));
  const listed = [...orderedSchemaIssues, ...unorderedSchemaIssues].map(
    (issue) => {
      const rhf = rhfByPath.get(issue.path);
      return {
        path: issue.path,
        label: labelForPolicyFieldPath(issue.path),
        message: rhf?.message || issue.message,
      };
    },
  );
  for (const issue of rhfIssues) {
    if (listed.some((item) => item.path === issue.path)) continue;
    listed.push({
      path: issue.path,
      label: labelForPolicyFieldPath(issue.path),
      message: issue.message,
    });
  }
  return {
    invalidIssues: listed,
    sectionIssueCounts: counts,
    sectionFirstIssuePaths: firstPaths,
    sectionIssuePaths: allPaths,
    isFormValid: false,
  };
}

export function useWizardValidationState({
  form,
  values,
}: {
  form: UseFormReturn<CarPolicyFormValues>;
  values: CarPolicyFormValues;
}) {
  const rhfErrors = form.formState.errors;

  const {
    invalidIssues,
    sectionIssueCounts,
    sectionFirstIssuePaths,
    sectionIssuePaths,
    isFormValid,
  } = useMemo(
    () => computeWizardValidationState(values, rhfErrors, WIZARD_FIELD_ORDER),
    [values, rhfErrors],
  );

  return {
    invalidIssues,
    sectionIssueCounts,
    sectionFirstIssuePaths,
    sectionIssuePaths,
    isFormValid,
    fieldOrder: WIZARD_FIELD_ORDER,
  };
}
