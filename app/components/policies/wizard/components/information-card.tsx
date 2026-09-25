import { memo } from "react";
import { useFormContext } from "react-hook-form";

import { PolicyInformationCard } from "~/components/policies/policy-form-layout";
import type { Policy, PremiumBreakdown, ReferenceData } from "~/lib/db/types";
import { getTakenStatusIssues } from "~/lib/policies/taken-status";
import { type CarPolicyFormValues, POLICY_STATUS } from "~/lib/zod/policy-car";

import { usePolicyPhase } from "../hooks/utils/use-policy-phase";
import { useWizardDisplayFields } from "../hooks/wizard/use-wizard-display-fields";
import { SECTION_IDS } from "../shared/constants";

type InformationCardProps = {
  borderClassName: string;
  canChangeStatus: boolean;
  premium: PremiumBreakdown | undefined;
  premiumRef: React.RefObject<PremiumBreakdown | undefined>;
  isFetcherBusy: boolean;
  isCalculating: boolean;
  terminalStatusSaving?: boolean;
  handleFieldBlur: () => void;
  confirmTerminalStatusAndSave: (statusId: number) => void;
  markAttentionPaths: (paths: string[]) => void;
  navigateToSection: (sectionId: string) => void;
  setOpenMap: (
    map:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  policy: Policy;
  reference: ReferenceData;
};

export const InformationCard = memo(function InformationCard({
  borderClassName,
  canChangeStatus,
  premium,
  premiumRef,
  isFetcherBusy,
  isCalculating,
  terminalStatusSaving = false,
  handleFieldBlur,
  confirmTerminalStatusAndSave,
  markAttentionPaths,
  navigateToSection,
  setOpenMap,
  policy,
  reference,
}: InformationCardProps) {
  const { policyNumberEditable } = usePolicyPhase();
  const { selectedStatus, insurerName, livePolicyNumber } =
    useWizardDisplayFields(policy, reference);
  const form = useFormContext<CarPolicyFormValues>();
  const policyNumberError = form.formState.errors.policyNumber?.message;
  const selectedStatusId =
    selectedStatus?.policyStatusId ?? policy.policyStatusId;

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
      policyNumber={livePolicyNumber}
      seriesTerm={policy.seriesTerm}
      policyNumberEditable={policyNumberEditable}
      onPolicyNumberChange={(next) => {
        form.clearErrors("policyNumber");
        form.setValue("policyNumber", next, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }}
      onPolicyNumberBlur={handleFieldBlur}
      policyNumberError={policyNumberError}
      statusId={selectedStatusId}
      statusName={selectedStatus?.name ?? "Pending"}
      statusOptions={reference.policyStatuses}
      canChangeStatus={canChangeStatus}
      onStatusChange={(next) => {
        form.setValue("policyStatusId", next, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }}
      onConfirmTerminalStatus={confirmTerminalStatusAndSave}
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
        setOpenMap((prev) => ({ ...prev, premium: true }));
        navigateToSection(SECTION_IDS.PREMIUM);
        markAttentionPaths(keys);
        const firstKey = keys[0];
        const target =
          (firstKey
            ? document.getElementById(`premium-row-${firstKey}`)
            : null) ?? document.getElementById(SECTION_IDS.PREMIUM);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      statusConfirmBusy={
        (isFetcherBusy && !isCalculating) || terminalStatusSaving
      }
      adjusted={Boolean(policy.car.adjusted)}
      className={borderClassName}
    />
  );
});
