import { useFormContext } from "react-hook-form";
import { PolicyInformationCard } from "~/components/policies/policy-form-layout";
import { getTakenStatusIssues } from "~/lib/policies/taken-status";
import { POLICY_STATUS, type CarPolicyFormValues } from "~/lib/zod/policy-car";
import type { Policy, PremiumBreakdown, ReferenceData } from "~/lib/db/types";
import type { MutableRefObject } from "react";

export type CarPolicyWizardInformationCardProps = {
  policy: Policy;
  reference: ReferenceData;
  insurerName: string;
  selectedStatusId: number;
  selectedStatusName: string;
  canChangeStatus: boolean;
  premium: PremiumBreakdown | undefined;
  premiumRef: MutableRefObject<PremiumBreakdown | undefined>;
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
  premium,
  premiumRef,
  isFetcherBusy,
  isCalculating,
  className,
  onConfirmTerminalStatus,
  onOpenPremiumSection,
  onMarkAttentionPaths,
}: CarPolicyWizardInformationCardProps) {
  const form = useFormContext<CarPolicyFormValues>();

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
      policyNumber={policy.policyNumber}
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
              : null) ?? document.getElementById("premium");
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
      }}
      statusConfirmBusy={isFetcherBusy && !isCalculating}
      adjusted={Boolean(policy.car.adjusted)}
      className={className}
    />
  );
}
