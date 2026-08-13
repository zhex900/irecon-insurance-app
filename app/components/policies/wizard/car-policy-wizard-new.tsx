import { cn } from "~/lib/utils";
import { CarPolicyWizardHeader } from "./car-policy-wizard-header";
import { CarPolicyWizardInformationCard } from "./car-policy-wizard-information-card";
import { CarPolicyWizardPremiumPanel } from "./car-policy-wizard-premium-panel";
import { CarPolicyWizardDesktopRail } from "./car-policy-wizard-desktop-rail";
import { CarPolicyWizardMobileNotes } from "./car-policy-wizard-mobile-notes";
import { WizardSectionStack } from "./section-stack";
import { WizardFormFooter } from "./form-footer";
import { CarPolicyWizardDialogs } from "./car-policy-wizard-dialogs";
import { POLICY_STICKY_RAIL_CLASS } from "~/components/policies/policy-form-layout";
import { SECTION_IDS } from "./constants";
import { useCarPolicyWizardState, type CarPolicyWizardState } from "./car-policy-wizard-decomposed";

export function CarPolicyWizardNew({
  policy,
  reference,
  carWording,
  clientName = "",
  brokerName = "",
  brokerEmail = "",
  noteAuthors: initialNoteAuthors,
  emailTemplates = [],
  emailDirectory = [],
  emailTemplateVars,
  footerImageWidth,
  headerActions,
}: Omit<Parameters<typeof useCarPolicyWizardState>[0], 'readOnly' | 'isNew' | 'freshSteps'>) {
  const state = useCarPolicyWizardState({
    policy,
    reference,
    carWording,
    clientName,
    brokerName,
    brokerEmail,
    noteAuthors: initialNoteAuthors,
    emailTemplates,
    emailDirectory,
    emailTemplateVars,
    footerImageWidth,
    headerActions,
  });

  return (
    <div
      className={cn(
        // Bleed into app content padding. On xl, lock height under the app
        // header so side rails stay put and only the centre form scrolls.
        "-mx-4 -mt-4 flex flex-col gap-4 md:-mx-8 md:-mt-8",
        "xl:-mb-4 xl:h-[calc(100svh-3.5rem)] xl:min-h-0 xl:overflow-hidden md:xl:-mb-8",
        // Keep cards within the column — no horizontal scrollbars.
        "[&_[data-slot=card]]:overflow-x-hidden",
        state.wizardMode === "view" &&
          "[&_[data-slot=card]]:bg-muted/40 [&_input]:bg-muted/30 [&_select]:bg-muted/30 [&_textarea]:bg-muted/30",
      )}
      data-wizard-mode={state.wizardMode}
    >
      <CarPolicyWizardHeader
        policyNumber={state.livePolicyNumber}
        clientId={policy.clientId}
        clientName={clientName}
        coverTypeName={state.coverTypeName || undefined}
        selectedStatus={state.selectedStatus}
        saveStatus={state.saveStatus}
        adjusted={Boolean(policy.car.adjusted)}
        headerActions={headerActions}
        submitDisabled={state.submitDisabled}
        submitBusy={state.submitBusy}
        onRequestSubmit={() => {
          void state.requestSubmit();
        }}
        navItems={state.navItems}
        activeSectionId={state.activeSectionId}
        onNavigateSection={state.navigation.navigateToSection}
        sectionIssueCounts={state.sectionIssueCounts}
        onNavigateToSectionFirstIssue={state.handleSectionIssueCounter}
      />

      <div className="grid min-h-0 flex-1 gap-6 px-4 pb-4 md:px-8 xl:grid-cols-[200px_minmax(0,1fr)_300px] xl:overflow-hidden xl:pb-4">
        <CarPolicyWizardDesktopRail
          navItems={state.navItems}
          activeSectionId={state.activeSectionId}
          openMap={state.openMap}
          onNavigateSection={state.navigation.navigateToSection}
          onToggleSection={(sectionId, open) => {
            state.setOpenMap((prev) => ({ ...prev, [sectionId]: open }));
          }}
          invalidIssues={state.invalidIssues}
          sectionIssueCounts={state.sectionIssueCounts}
          onNavigateToIssue={state.handleNavigateToIssue}
          onNavigateToSectionFirstIssue={state.handleSectionIssueCounter}
          notes={state.notes}
          noteAuthors={state.noteAuthors}
          policyIsDraft={Boolean(policy.isDraft)}
          onAddNote={state.addNote}
          onUpdateNote={state.updateNote}
          noteBusy={state.isSavingNote}
          noteError={state.noteError}
        />

        <div
          data-policy-form-scroll
          className="flex min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden xl:overflow-y-auto xl:overscroll-contain xl:[&>*]:shrink-0"
        >
          <CarPolicyWizardInformationCard
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
            onMarkAttentionPaths={state.markAttentionPaths}
          />

          <div className="xl:hidden">
            <CarPolicyWizardPremiumPanel
              documentsOnly
              {...state.premiumPanelProps}
            />
          </div>

          {!state.isNew ? (
            <div className="xl:hidden">
              <CarPolicyWizardMobileNotes
                notes={state.notes}
                noteAuthors={state.noteAuthors}
                policyIsDraft={Boolean(policy.isDraft)}
                onAddNote={state.addNote}
                onUpdateNote={state.updateNote}
                noteBusy={state.isSavingNote}
                noteError={state.noteError}
              />
            </div>
          ) : null}

          <WizardSectionStack
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
            onExportExcel={() => {
              void state.exportPremiumExcel();
            }}
            isExportingExcel={state.isExportingExcel}
            shellCardClassName={state.borderClassName}
          />

          <WizardFormFooter
            actionData={state.fetcher.data}
            onCancel={state.handleCancelClick}
            onSubmit={() => {
              void state.requestSubmit();
            }}
            submitBusy={state.submitBusy}
            submitDisabled={state.submitDisabled}
          />
        </div>

        <aside className={cn("hidden xl:block", POLICY_STICKY_RAIL_CLASS)}>
          <CarPolicyWizardPremiumPanel
            {...state.premiumPanelProps}
            adjustment={
              policy.car.adjusted ? policy.car.adjustment : undefined
            }
          />
        </aside>
      </div>

      <CarPolicyWizardDialogs
        submitConfirmOpen={state.submitConfirmOpen}
        onSubmitConfirmOpenChange={state.setSubmitConfirmOpen}
        submitDocumentNames={state.submitDocumentNames}
        submitBusy={state.submitBusy}
        onSubmitConfirm={() => {
          void state.confirmSubmit().then((ok) => {
            if (!ok) return;
            state.setSubmittedInSession(true);
            state.setSubmittedFingerprint(
              JSON.stringify({
                values: state.form.getValues(),
                premium: state.premiumRef.current ?? state.premium ?? null,
              }),
            );
          });
        }}
        leaveDialogOpen={state.leaveDialogOpen}
        pendingLeaveAfterSave={state.pendingLeaveAfterSave}
        discarding={state.discarding}
        onStay={state.stayOnPage}
        onLeaveWithoutSaving={state.leaveWithoutSaving}
        onSaveAndLeave={state.saveAndLeave}
      />
    </div>
  );
}