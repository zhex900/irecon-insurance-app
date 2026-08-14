import { useMemo } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { POLICY_FORM_SECTIONS } from "~/components/policies/policy-form-layout";
import { flattenFieldErrors, orderFormIssues } from "~/lib/form-validation-ui";
import { labelForPolicyFieldPath } from "~/lib/policies/field-labels";
import {
  carPolicySchema,
  getPolicyRuleIssues,
  wizardStepFields,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import { SECTION_IDS } from "../shared/constants";
import {
  findStepForFieldPath,
  sectionIdForStep,
} from "./use-wizard-navigation-utils";

export function useWizardValidationState({
  form,
}: {
  form: UseFormReturn<CarPolicyFormValues>;
}) {
  const watchedValues = useWatch({ control: form.control });
  const watchedKey = JSON.stringify(watchedValues);
  const rhfErrors = form.formState.errors;

  const fieldOrder = useMemo(
    () => Object.values(wizardStepFields).flat().map(String),
    [],
  );

  const {
    invalidIssues,
    sectionIssueCounts,
    sectionFirstIssuePaths,
    sectionIssuePaths,
    isFormValid,
  } = useMemo(() => {
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

    const values = JSON.parse(watchedKey) as CarPolicyFormValues;
    const parsed = carPolicySchema.safeParse(values);
    const rhfIssues = flattenFieldErrors(rhfErrors);
    const rhfByPath = new Map(rhfIssues.map((issue) => [issue.path, issue]));

    if (parsed.success) {
      // Schema clean — still surface any RHF-only errors (e.g. review status).
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
    // Zod skips superRefine when preprocess fields return undefined (empty
    // money/boolean selects). Always merge cross-field rules for the nav.
    for (const issue of getPolicyRuleIssues(values)) {
      const path = issue.path.map(String).join(".");
      if (!path || messageByPath.has(path)) continue;
      messageByPath.set(path, issue.message);
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
    // Prefer RHF message when present (post-trigger wording), else Zod message.
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
    // RHF-only paths outside the schema map (e.g. review status).
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
  }, [watchedKey, fieldOrder, rhfErrors]);

  return {
    invalidIssues,
    sectionIssueCounts,
    sectionFirstIssuePaths,
    sectionIssuePaths,
    isFormValid,
    fieldOrder,
  };
}
