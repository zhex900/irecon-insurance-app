import { useEffect, useRef, useState } from "react";
import {
  POLICY_FORM_SECTIONS,
  sectionIdForStep,
  stepIndexForSection,
  usePolicySectionScrollSpy,
} from "~/components/policies/policy-form-layout";
import { SECTION_IDS } from "../constants";
import { rememberWizardStep } from "../step-memory";

export function useWizardSectionManagement({
  policyId,
  navIds,
  step,
  maxStep,
  setStep,
  setMaxStep,
}: {
  policyId: string;
  navIds: string[];
  step: number;
  maxStep: number;
  setStep: (step: number) => void;
  setMaxStep: (maxStep: number) => void;
}) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries([
      ...POLICY_FORM_SECTIONS.map((s) => [s.id, true]),
      [SECTION_IDS.PREMIUM, true],
    ]),
  );
  const [activeSectionId, setActiveSectionId] =
    usePolicySectionScrollSpy(navIds);

  function navigateToSection(
    sectionId: string,
    { ensureOpen = true }: { ensureOpen?: boolean } = {},
  ) {
    if (sectionId !== SECTION_IDS.POLICY_INFORMATION) {
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

  return {
    openMap,
    setOpenMap,
    activeSectionId,
    setActiveSectionId,
    navigateToSection,
  };
}