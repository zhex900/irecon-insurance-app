import { type ReactNode, useMemo, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { useFetcher, useNavigate } from "react-router";

import { useJustSaved } from "~/components/forms/field-save-highlight";
import { getPolicyFormNavItems } from "~/components/policies/policy-form-layout";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import type { PolicyWizardActionData } from "../hooks/composite/use-premium-calc";
import type { PolicyLeaveApi } from "../hooks/draft/use-draft-types";
import { usePolicyPhase } from "../hooks/utils/use-mode";
import { useDeferredFormValues } from "../hooks/wizard/use-deferred-form-values";
import type { WizardProps } from "../shared/wizard-shared";

export type WizardStateProps = Omit<
  WizardProps,
  "initialIsNew" | "freshSteps"
> & {
  headerActions?: ReactNode;
};

export function useWizardCore() {
  const form = useFormContext<CarPolicyFormValues>();
  const deferredValues = useDeferredFormValues(form);
  const justSaved = useJustSaved();
  const fetcher = useFetcher<PolicyWizardActionData>();
  const navigate = useNavigate();
  const leaveApiRef = useRef<PolicyLeaveApi | null>(null);
  const getLeaveApi = () => leaveApiRef.current;
  const phase = usePolicyPhase();
  const navItems = useMemo(
    () => getPolicyFormNavItems(phase.premiumPinned),
    [phase.premiumPinned],
  );
  const navIds = useMemo(
    () => navItems.map((item: { id: string }) => item.id),
    [navItems],
  );

  return {
    form,
    deferredValues,
    justSaved,
    fetcher,
    navigate,
    leaveApiRef,
    getLeaveApi,
    phase,
    navItems,
    navIds,
  };
}
