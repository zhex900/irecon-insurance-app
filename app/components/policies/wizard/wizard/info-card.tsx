import { useJustSaved } from "~/components/forms/field-save-highlight";

import { InformationCard } from "../components/information-card";
import { SECTION_IDS } from "../shared/constants";
import { useWizardInner } from "./provider";

export function InfoCard() {
  const { state, props } = useWizardInner();
  const { policy, reference } = props;

  return (
    <InformationCard
      policy={policy}
      reference={reference}
      insurerName={state.insurerName}
      selectedStatusId={
        state.selectedStatus?.policyStatusId ?? policy.policyStatusId
      }
      selectedStatusName={state.selectedStatus?.name ?? "Pending"}
      canChangeStatus={state.canChangeStatus}
      onPolicyNumberBlur={state.handleFieldBlur}
      premium={state.premium}
      premiumRef={state.premiumRef}
      isFetcherBusy={state.isFetcherBusy}
      isCalculating={state.isCalculating}
      className={state.borderClassName}
      onConfirmTerminalStatus={state.confirmTerminalStatusAndSave}
      onOpenPremiumSection={() => {
        state.setOpenMap((prev) => ({ ...prev, premium: true }));
        state.navigation.navigateToSection(SECTION_IDS.PREMIUM);
      }}
      onMarkAttentionPaths={useJustSaved().markAttentionPaths}
    />
  );
}
