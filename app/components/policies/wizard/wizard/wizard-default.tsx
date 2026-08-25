import { useMemo } from "react";

import { POLICY_STICKY_RAIL_CLASS } from "~/components/policies/policy-form-layout";
import { usePolicySaveSync } from "~/hooks/policy";
import { cn } from "~/lib/utils";

import { DesktopRail } from "../components/desktop-rail";
import { DialogsContainer } from "../components/dialogs-container";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { InformationCard } from "../components/information-card";
import { MobileNotes } from "../components/mobile-notes";
import { DesktopPremium, MobilePremium } from "../components/premium-displays";
import { SectionStack } from "../components/section-stack";
import {
  useWizardCore,
  type WizardStateProps,
} from "../components/use-wizard-core";
import type { CarPolicyWizardState } from "../components/use-wizard-state";
import { useWizardState } from "../components/use-wizard-state";
import { WizardContainer } from "../components/wizard-container";
import { useDismissNewPolicyOnDraftSave } from "../hooks/utils/use-dismiss-new-on-draft-save";
import { usePolicyPhase } from "../hooks/utils/use-mode";

export function WizardDefault(props: WizardStateProps) {
  const core = useWizardCore();
  usePolicySaveSync({
    fetcher: core.fetcher,
    onPolicyUpdated: props.onPolicyUpdated,
  });
  const wizard = useWizardState(props, core);
  const { phase } = usePolicyPhase();
  const { navigation, premiumCalc, draftSave, submit, leave, gate } = wizard;

  useDismissNewPolicyOnDraftSave(draftSave.draftSavedAt);

  const rating =
    core.fetcher.data?.rating ?? props.policy.car.rating ?? undefined;

  const premiumSectionProps = useMemo(
    () => ({
      premium: premiumCalc.premium,
      premiumRef: premiumCalc.premiumRef,
      premiumManuallyEditedRef: premiumCalc.premiumManuallyEditedRef,
      premiumManualKeysRef: premiumCalc.premiumManualKeysRef,
      setPremiumManualKeys: premiumCalc.setPremiumManualKeys,
      setPremium: premiumCalc.setPremium,
      hasUnsavedChangesRef: draftSave.hasUnsavedChangesRef,
      setHasUnsavedChanges: draftSave.setHasUnsavedChanges,
      persistDraft: draftSave.persistDraft,
      initialManualKeys: premiumCalc.premiumManualKeys,
      resetManualPremium: premiumCalc.resetManualPremium,
      isCalculating: premiumCalc.isCalculating,
      exportPremiumExcel: wizard.exportPremiumExcel,
      isExportingExcel: wizard.documents.isExportingExcel,
      adjustmentBreakdown: props.policy.car.adjusted
        ? props.policy.car.adjustment?.breakdown
        : undefined,
    }),
    [
      draftSave.hasUnsavedChangesRef,
      draftSave.persistDraft,
      draftSave.setHasUnsavedChanges,
      premiumCalc.isCalculating,
      premiumCalc.premium,
      premiumCalc.premiumManuallyEditedRef,
      premiumCalc.premiumManualKeys,
      premiumCalc.premiumManualKeysRef,
      premiumCalc.premiumRef,
      premiumCalc.resetManualPremium,
      premiumCalc.setPremium,
      premiumCalc.setPremiumManualKeys,
      props.policy.car.adjusted,
      props.policy.car.adjustment?.breakdown,
      wizard.documents.isExportingExcel,
      wizard.exportPremiumExcel,
    ],
  );

  return (
    <WizardContainer phase={phase}>
      <Header
        policy={props.policy}
        reference={props.reference}
        clientName={props.clientName}
        headerActions={props.headerActions}
        saveStatus={draftSave.saveStatus}
        submitDisabled={gate.submitDisabled || submit.submitBlocked}
        submitBusy={submit.submitting || submit.submitConfirmLoading}
        requestSubmit={submit.requestSubmit}
        navItems={core.navItems}
        activeSectionId={navigation.activeSectionId}
        onNavigate={navigation.navigateToSection}
        sectionIssueCounts={navigation.sectionIssueCounts}
        onNavigateToSectionFirstIssue={wizard.handleSectionIssueCounter}
      />

      <div className="grid min-h-0 flex-1 gap-6 px-4 pb-4 md:px-8 xl:grid-cols-[200px_minmax(0,1fr)_300px] xl:overflow-hidden xl:pb-4">
        <DesktopRail
          activeSectionId={navigation.activeSectionId}
          openMap={navigation.openMap}
          setOpenMap={navigation.setOpenMap}
          onNavigate={navigation.navigateToSection}
          invalidIssues={navigation.invalidIssues}
          sectionIssueCounts={navigation.sectionIssueCounts}
          onNavigateToIssue={wizard.handleNavigateToIssue}
          onNavigateToSectionFirstIssue={wizard.handleSectionIssueCounter}
          navItems={core.navItems}
          policy={props.policy}
          noteAuthors={props.noteAuthors}
          fetcher={core.fetcher}
          onPolicyUpdated={props.onPolicyUpdated}
        />

        <div
          data-policy-form-scroll
          className="flex min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden xl:overflow-y-auto xl:overscroll-contain xl:[&>*]:shrink-0"
        >
          <InformationCard
            borderClassName={wizard.borderClassName}
            canChangeStatus={wizard.canChangeStatus}
            premium={premiumCalc.premium}
            premiumRef={premiumCalc.premiumRef}
            isFetcherBusy={premiumCalc.isFetcherBusy}
            isCalculating={premiumCalc.isCalculating}
            terminalStatusSaving={submit.terminalStatusSaving}
            handleFieldBlur={draftSave.handleFieldBlur}
            confirmTerminalStatusAndSave={submit.confirmTerminalStatusAndSave}
            markAttentionPaths={core.justSaved.markAttentionPaths}
            navigateToSection={navigation.navigateToSection}
            setOpenMap={navigation.setOpenMap}
            policy={props.policy}
            reference={props.reference}
          />
          <MobilePremium
            premiumPanelProps={wizard.premiumPanelProps}
            policy={props.policy}
            reference={props.reference}
          />
          <MobileNotes
            policy={props.policy}
            noteAuthors={props.noteAuthors}
            fetcher={core.fetcher}
            onPolicyUpdated={props.onPolicyUpdated}
          />
          <SectionStack
            openMap={navigation.openMap}
            setOpenMap={navigation.setOpenMap}
            borderClassName={wizard.borderClassName}
            handleFieldBlur={draftSave.handleFieldBlur}
            reference={props.reference}
            referenceFeeNamesPending={props.referenceFeeNamesPending}
            carWording={wizard.carWording}
            rating={rating}
            premiumSectionProps={premiumSectionProps}
          />
          <Footer
            submitDisabled={gate.submitDisabled || submit.submitBlocked}
            submitBusy={submit.submitting || submit.submitConfirmLoading}
            requestSubmit={submit.requestSubmit}
            handleCancelClick={leave.handleCancelClick}
            actionData={core.fetcher.data}
          />
        </div>

        <aside className={cn("hidden xl:block", POLICY_STICKY_RAIL_CLASS)}>
          <DesktopPremium
            premiumPanelProps={wizard.premiumPanelProps}
            policy={props.policy}
            reference={props.reference}
          />
        </aside>
      </div>

      <DialogsContainer
        form={core.form}
        premium={premiumCalc.premium}
        premiumRef={premiumCalc.premiumRef}
        submitConfirmOpen={submit.submitConfirmOpen}
        dismissSubmitConfirm={submit.dismissSubmitConfirm}
        submitDocumentNames={submit.submitDocumentNames}
        submitBusy={submit.submitting}
        confirmSubmit={submit.confirmSubmit}
        setSubmittedFingerprint={gate.setSubmittedFingerprint}
        pendingLeaveAfterSave={leave.pendingLeaveAfterSave}
        discarding={leave.discarding}
        leaveDialogOpen={leave.leaveDialogOpen}
        stayOnPage={leave.stayOnPage}
        leaveWithoutSaving={leave.leaveWithoutSaving}
        saveAndLeave={leave.saveAndLeave}
      />
    </WizardContainer>
  );
}

export type { CarPolicyWizardState, WizardStateProps };
