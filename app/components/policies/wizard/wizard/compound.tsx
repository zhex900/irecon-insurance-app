import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { cn } from "~/lib/utils";
import { Dialogs } from "../components/dialogs";
import { MobileNotes } from "../components/mobile-notes";
import { Footer } from "../components/footer";
import { SectionStack } from "../components/section-stack";
import { Header } from "../components/header";
import { InformationCard } from "../components/information-card";
import { PremiumPanel } from "../components/premium-panel";
import { DesktopRail } from "../components/desktop-rail";
import { Container as WizardContainer } from "../components/container";
import { POLICY_STICKY_RAIL_CLASS } from "~/components/policies/policy-form-layout";
import { SECTION_IDS } from "../shared/constants";
import type { WizardProps } from "../shared/shared";
import { useWizardState } from "../components/decomposed";
import { useMode } from "../hooks/use-mode";
import { useJustSaved } from "~/components/forms/field-save-highlight";

// Context for wizard inner state
type WizardInnerState = ReturnType<typeof useWizardState>;

interface WizardInnerContextValue {
  state: WizardInnerState;
  props: Omit<WizardProps, "readOnly" | "isNew" | "freshSteps">;
}

const WizardInnerContext = createContext<WizardInnerContextValue | null>(null);

function useWizardInner() {
  const context = useContext(WizardInnerContext);
  if (!context) {
    throw new Error("useWizardInner must be used within a WizardInnerProvider");
  }
  return context;
}

// Provider component
interface WizardInnerProviderProps extends Omit<
  WizardProps,
  "readOnly" | "isNew" | "freshSteps"
> {
  children: ReactNode;
}

export function WizardInnerProvider({
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
  children,
}: WizardInnerProviderProps) {
  const state = useWizardState({
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

  const props = useMemo(
    () => ({
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
    }),
    [
      policy,
      reference,
      carWording,
      clientName,
      brokerName,
      brokerEmail,
      initialNoteAuthors,
      emailTemplates,
      emailDirectory,
      emailTemplateVars,
      footerImageWidth,
      headerActions,
    ],
  );

  const value = useMemo(
    () => ({
      state,
      props,
    }),
    [state, props],
  );

  return (
    <WizardInnerContext.Provider value={value}>
      {children}
    </WizardInnerContext.Provider>
  );
}

// Container component with default styling
export function Container({ children }: { children: ReactNode }) {
  const { wizardMode } = useMode();

  return (
    <div
      className={cn(
        // Bleed into app content padding. On xl, lock height under the app
        // header so side rails stay put and only the centre form scrolls.
        "-mx-4 -mt-4 flex flex-col gap-4 md:-mx-8 md:-mt-8",
        "xl:-mb-4 xl:h-[calc(100svh-3.5rem)] xl:min-h-0 xl:overflow-hidden md:xl:-mb-8",
        // Keep cards within the column — no horizontal scrollbars.
        "[&_[data-slot=card]]:overflow-x-hidden",
        wizardMode === "view" &&
          "[&_[data-slot=card]]:bg-muted/40 [&_input]:bg-muted/30 [&_select]:bg-muted/30 [&_textarea]:bg-muted/30",
      )}
      data-wizard-mode={wizardMode}
    >
      {children}
    </div>
  );
}

// Grid layout component
export function CarPolicyWizardInnerGrid({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-0 flex-1 gap-6 px-4 pb-4 md:px-8 xl:grid-cols-[200px_minmax(0,1fr)_300px] xl:overflow-hidden xl:pb-4">
      {children}
    </div>
  );
}

// Main content area component
export function CarPolicyWizardInnerMainContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      data-policy-form-scroll
      className="flex min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden xl:overflow-y-auto xl:overscroll-contain xl:[&>*]:shrink-0"
    >
      {children}
    </div>
  );
}

// Premium aside component
export function CarPolicyWizardInnerPremiumAside({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <aside className={cn("hidden xl:block", POLICY_STICKY_RAIL_CLASS)}>
      {children}
    </aside>
  );
}

// Default slots/components that use the context
export function CarPolicyWizardInnerHeader() {
  const { state, props } = useWizardInner();
  const { policy, clientName = "", headerActions } = props;

  return (
    <Header
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
  );
}

export function CarPolicyWizardInnerDesktopRail() {
  const { state, props } = useWizardInner();
  const { policy } = props;

  return (
    <DesktopRail
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
  );
}

export function CarPolicyWizardInnerInformationCard() {
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

export function CarPolicyWizardInnerMobilePremiumPanel() {
  const { state, props } = useWizardInner();
  const {
    policy,
    reference,
    clientName = "",
    brokerName = "",
    brokerEmail = "",
    emailTemplates = [],
    emailDirectory = [],
    emailTemplateVars,
    footerImageWidth,
    carWording,
  } = props;

  return (
    <div className="xl:hidden">
      <PremiumPanel
        documentsOnly
        premium={state.premium}
        referralReasons={state.referralReasons}
        isCalculating={state.isCalculating}
        documents={state.documents}
        isGeneratingDocuments={state.isGeneratingDocuments}
        policyNumber={state.livePolicyNumber}
        clientName={clientName}
        brokerName={brokerName}
        brokerEmail={brokerEmail}
        emailTemplates={emailTemplates}
        emailDirectory={emailDirectory}
        emailTemplateVars={emailTemplateVars}
        footerImageWidth={footerImageWidth}
        policy={policy}
        getPreviewPolicy={state.buildDocumentSnapshot}
        carWording={carWording}
        brokerFeeLines={reference.feeNames}
        className={state.borderClassName}
      />
    </div>
  );
}

export function CarPolicyWizardInnerMobileNotes() {
  const { state, props } = useWizardInner();
  const { isNew } = useMode();
  const { policy } = props;

  if (isNew) return null;

  return (
    <div className="xl:hidden">
      <MobileNotes
        notes={state.notes}
        noteAuthors={state.noteAuthors}
        policyIsDraft={Boolean(policy.isDraft)}
        onAddNote={state.addNote}
        onUpdateNote={state.updateNote}
        noteBusy={state.isSavingNote}
        noteError={state.noteError}
      />
    </div>
  );
}

export function CarPolicyWizardInnerSectionStack() {
  const { state, props } = useWizardInner();
  const { policy, reference, carWording } = props;

  return (
    <SectionStack
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

export function CarPolicyWizardInnerFormFooter() {
  const { state } = useWizardInner();

  return (
    <Footer
      actionData={state.fetcher.data}
      onCancel={state.handleCancelClick}
      onSubmit={() => {
        void state.requestSubmit();
      }}
      submitBusy={state.submitBusy}
      submitDisabled={state.submitDisabled}
    />
  );
}

export function CarPolicyWizardInnerDesktopPremiumPanel() {
  const { state, props } = useWizardInner();
  const {
    policy,
    reference,
    clientName = "",
    brokerName = "",
    brokerEmail = "",
    emailTemplates = [],
    emailDirectory = [],
    emailTemplateVars,
    footerImageWidth,
    carWording,
  } = props;

  return (
    <PremiumPanel
      premium={state.premium}
      referralReasons={state.referralReasons}
      isCalculating={state.isCalculating}
      documents={state.documents}
      isGeneratingDocuments={state.isGeneratingDocuments}
      policyNumber={state.livePolicyNumber}
      clientName={clientName}
      brokerName={brokerName}
      brokerEmail={brokerEmail}
      emailTemplates={emailTemplates}
      emailDirectory={emailDirectory}
      emailTemplateVars={emailTemplateVars}
      footerImageWidth={footerImageWidth}
      policy={policy}
      getPreviewPolicy={state.buildDocumentSnapshot}
      carWording={carWording}
      brokerFeeLines={reference.feeNames}
      className={state.borderClassName}
      adjustment={policy.car.adjusted ? policy.car.adjustment : undefined}
    />
  );
}

export function CarPolicyWizardInnerDialogs() {
  const { state } = useWizardInner();

  return (
    <Dialogs
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
  );
}

// Default composition - replicates the original CarPolicyWizardInnerContent
export function Default() {
  const { wizardMode } = useMode();
  return (
    <WizardContainer wizardMode={wizardMode}>
      <CarPolicyWizardInnerHeader />

      <CarPolicyWizardInnerGrid>
        <CarPolicyWizardInnerDesktopRail />

        <CarPolicyWizardInnerMainContent>
          <CarPolicyWizardInnerInformationCard />
          <CarPolicyWizardInnerMobilePremiumPanel />
          <CarPolicyWizardInnerMobileNotes />
          <CarPolicyWizardInnerSectionStack />
          <CarPolicyWizardInnerFormFooter />
        </CarPolicyWizardInnerMainContent>

        <CarPolicyWizardInnerPremiumAside>
          <CarPolicyWizardInnerDesktopPremiumPanel />
        </CarPolicyWizardInnerPremiumAside>
      </CarPolicyWizardInnerGrid>

      <CarPolicyWizardInnerDialogs />
    </WizardContainer>
  );
}
