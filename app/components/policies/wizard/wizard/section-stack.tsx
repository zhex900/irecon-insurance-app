import { SectionStack as SectionStackComponent } from "../components/section-stack";
import { useWizardInner } from "./provider";

export function SectionStack() {
  const { state, props } = useWizardInner();
  const { policy, reference, carWording } = props;

  return (
    <SectionStackComponent
      openMap={state.openMap}
      setOpenMap={state.setOpenMap}
      reference={reference}
      carWording={carWording}
      premium={state.premium}
      referralReasons={state.referralReasons}
      notes={state.notes}
      policy={policy}
      rating={state.fetcher.data?.rating ?? policy.car.rating}
      premiumManuallyEditedRef={state.premiumManuallyEditedRef}
      premiumManualKeysRef={state.premiumManualKeysRef}
      premiumRef={state.premiumRef}
      setPremium={state.setPremium}
      hasUnsavedChangesRef={state.hasUnsavedChangesRef}
      setHasUnsavedChanges={state.setHasUnsavedChanges}
      persistDraft={state.persistDraft}
      handleFieldBlur={state.handleFieldBlur}
      onResetPremium={state.resetManualPremium}
      isCalculating={state.isCalculating}
      onExportExcel={state.exportPremiumExcel}
      isExportingExcel={state.isExportingExcel}
      shellCardClassName={state.borderClassName}
    />
  );
}
