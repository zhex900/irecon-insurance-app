import { useFormContext } from "react-hook-form";
import { PolicyInformationCard } from "~/components/policies/policy-form-layout";
import { getTakenStatusIssues } from "~/lib/policies/taken-status";
import { POLICY_STATUS, type CarPolicyFormValues } from "~/lib/zod/policy-car";
import type { Policy, PremiumBreakdown, ReferenceData } from "~/lib/db/types";
import type { RefObject } from "react";
import { usePolicyWizardMode } from "./car-policy-wizard-mode-context";
import { SECTION_IDS } from "./constants";

export type CarPolicyWizardInformationCardProps = {
  policy: Policy;
  reference: ReferenceData;
  insurerName: string;
  selectedStatusId: number;
  selectedStatusName: string;
  canChangeStatus: boolean;
  onPolicyNumberBlur?: () => void;
  premium: PremiumBreakdown | undefined;
  premiumRef: RefObject<PremiumBreakdown | undefined>;
  isFetcherBusy: boolean;
  isCalculating: boolean;
  className?: string;
  onConfirmTerminalStatus: (statusId: number) => void;
  onOpenPremiumSection: () => void;
  onMarkAttentionPaths: (paths: string[]) => void;
};

export function CarPolicyWizardInformationCard({
  policy,
  reference,
  insurerName,
  selectedStatusId,
  selectedStatusName,
  canChangeStatus,
  onPolicyNumberBlur,
  premium,
  premiumRef,
  isFetcherBusy,
  isCalculating,
  className,
  onConfirmTerminalStatus,
  onOpenPremiumSection,
  onMarkAttentionPaths,
}: CarPolicyWizardInformationCardProps) {
  const { policyNumberEditable } = usePolicyWizardMode();
  const form = useFormContext<CarPolicyFormValues>();
  const policyNumber = form.watch("policyNumber") || policy.policyNumber;
  const policyNumberError = form.formState.errors.policyNumber?.message;

  function takenStatusIssues() {
    const values = form.getValues();
    const currentPremium = premiumRef.current ?? premium;
    return getTakenStatusIssues(values, {
      contractWorksExistingStructurePremium:
        currentPremium?.contractWorksExistingStructurePremium ?? 0,
      contractWorksPlantPremium: currentPremium?.contractWorksPlantPremium ?? 0,
    });
  }

  return (
    <PolicyInformationCard
      insurerName={insurerName}
      policyNumber={policyNumber}
      policyNumberEditable={policyNumberEditable}
      onPolicyNumberChange={(next) => {
        form.clearErrors("policyNumber");
        form.setValue("policyNumber", next, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }}
      onPolicyNumberBlur={onPolicyNumberBlur}
      policyNumberError={policyNumberError}
      statusId={selectedStatusId}
      statusName={selectedStatusName}
      statusOptions={reference.policyStatuses}
      canChangeStatus={canChangeStatus}
      onStatusChange={(next) => {
        form.setValue("policyStatusId", next, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }}
      onConfirmTerminalStatus={onConfirmTerminalStatus}
      validateTerminalStatus={(statusId) => {
        if (statusId !== POLICY_STATUS.Taken) return { ok: true };
        const issues = takenStatusIssues();
        if (issues.length === 0) return { ok: true };
        return {
          ok: false,
          requirements: issues.map((issue) => ({
            label: issue.label,
            message: issue.message,
          })),
        };
      }}
      onTerminalStatusInvalid={(statusId) => {
        if (statusId !== POLICY_STATUS.Taken) return;
        const issues = takenStatusIssues();
        const keys = issues.map((issue) => issue.premiumKey);
        onOpenPremiumSection();
        window.setTimeout(() => {
          onMarkAttentionPaths(keys);
          const firstKey = keys[0];
          const target =
            (firstKey
              ? document.getElementById(`premium-row-${firstKey}`)
              : null) ?? document.getElementById(SECTION_IDS.PREMIUM);
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
      }}
      statusConfirmBusy={isFetcherBusy && !isCalculating}
      adjusted={Boolean(policy.car.adjusted)}
      className={className}
    />
  );
}
