import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useFormContext } from "react-hook-form";
import { CarPolicyWizardDialogs } from "./car-policy-wizard-dialogs";
import { CarPolicyWizardMobileNotes } from "./car-policy-wizard-mobile-notes";
import { WizardFormFooter } from "./form-footer";
import { WizardSectionStack } from "./section-stack";
import {
  POLICY_STICKY_RAIL_CLASS,
  getPolicyFormNavItems,
} from "~/components/policies/policy-form-layout";
import {
  POLICY_STATUS,
  isTerminalStatus,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import { useJustSaved } from "~/components/forms/field-save-highlight";
import { cn } from "~/lib/utils";
import { usePolicyNotes } from "./hooks/use-notes";
import { usePolicyDocuments } from "./hooks/use-documents";
import {
  usePolicyPremiumCalc,
  type PolicyWizardActionData,
} from "./hooks/use-premium-calc";
import { usePolicyWizardNavigation } from "./hooks/use-navigation";
import {
  usePolicyDraftSave,
  type PolicyLeaveApi,
} from "./hooks/use-draft-save";
import { usePolicySubmit } from "./hooks/use-submit";
import { usePolicyLeaveGuard } from "./hooks/use-leave-guard";
import { useCarPolicyWizardSubmitGate } from "./hooks/use-submit-gate";
import { usePolicyDraftKeyboardSave } from "./hooks/use-draft-keyboard-save";
import {
  wizardModeCardBorderClass,
  type CarPolicyWizardProps,
  type WizardMode,
} from "./car-policy-wizard-shared";

import { CarPolicyWizardHeader } from "./car-policy-wizard-header";
import { CarPolicyWizardInformationCard } from "./car-policy-wizard-information-card";
import { CarPolicyWizardPremiumPanel } from "./car-policy-wizard-premium-panel";
import { CarPolicyWizardDesktopRail } from "./car-policy-wizard-desktop-rail";

export function CarPolicyWizardInner({
  policy,
  reference,
  carWording,
  readOnly = false,
  freshSteps = false,
  isNew = false,
  clientName = "",
  brokerName = "",
  brokerEmail = "",
  noteAuthors: initialNoteAuthors,
  emailTemplates = [],
  emailDirectory = [],
  emailTemplateVars,
  footerImageWidth,
  headerActions,
}: CarPolicyWizardProps) {
  const form = useFormContext<CarPolicyFormValues>();
  // Subscribe so post-trigger reads of formState.errors are current.
  void form.formState.errors;
  const {
    commitSavedPaths,
    rollbackSavedPaths,
    getDirtyPaths,
    markAttentionPaths,
  } = useJustSaved();

  const fetcher = useFetcher<PolicyWizardActionData>();
  const navigate = useNavigate();
  const leaveApiRef = useRef<PolicyLeaveApi | null>(null);
  const getLeaveApi = () => leaveApiRef.current;

  const selectedStatusId = Number(form.watch("policyStatusId"));
  const selectedStatus = reference.policyStatuses.find(
    (item) => item.policyStatusId === selectedStatusId,
  );
  const insurerCode = form.watch("insurerCode");
  const insurerName =
    reference.insurers.find((item) => item.code === insurerCode)?.name ??
    insurerCode;
  const isFormTerminal = isTerminalStatus(selectedStatusId);
  /** Fields lock once Taken/Not taken is chosen or already saved. */
  const fieldsLocked = readOnly || isFormTerminal;
  /**
   * After the first successful Submit, keep Submit off until values change again.
   * Draft autosave must NOT clear this — only a successful Submit resets it.
   * Also keeps Premium pinned under Policy Information (do not move it back).
   */
  /** Session submit, or already non-draft — pins Premium and gates re-submit. */
  const [submittedInSession, setSubmittedInSession] = useState(false);
  const hasSubmittedOnce = submittedInSession || !policy.isDraft;
  /** Pin Premium under Policy Information after submit — stay at the top. */
  const premiumPinned = hasSubmittedOnce;
  const navItems = useMemo(
    () => getPolicyFormNavItems(premiumPinned),
    [premiumPinned],
  );
  const navIds = useMemo(() => navItems.map((item) => item.id), [navItems]);

  const navigation = usePolicyWizardNavigation({
    policyId: policy.policyId,
    form,
    readOnly,
    freshSteps,
    fieldsLocked,
    policyPremium: policy.car.premium,
    isDraft: Boolean(policy.isDraft),
    navIds,
  });
  const {
    openMap,
    setOpenMap,
    activeSectionId,
    pendingFocusPathRef,
    goToStep,
    navigateToSection,
    navigateToIssue,
    navigateToSectionFirstIssue,
    firstIssuePath,
    findStepForField,
    invalidIssues,
    sectionIssueCounts,
    sectionIssuePaths,
    isFormValid,
    step,
  } = navigation;

  const { notes, noteAuthors, addNote, updateNote, noteError, isSavingNote } =
    usePolicyNotes({
      policy,
      noteAuthors: initialNoteAuthors,
      fetcher,
    });

  const premiumCalc = usePolicyPremiumCalc({
    policy,
    form,
    fetcher,
    fieldsLocked,
    premiumSectionOpen: openMap.premium ?? true,
  });
  const {
    premium,
    setPremium,
    premiumRef,
    premiumManuallyEditedRef,
    premiumManualKeysRef,
    referralReasons,
    setReferralReasons,
    isFetcherBusy,
    isCalculating,
    resetManualPremium,
    refreshPremiumAfterSave,
  } = premiumCalc;

  const {
    documents,
    isGeneratingDocuments,
    isExportingExcel,
    exportPremiumExcel,
    regenerateDocumentsIfNeeded,
    formDataChangedForDocuments,
    buildDocumentSnapshot,
  } = usePolicyDocuments({
    policy,
    form,
    premium,
    referralReasons,
    rating: fetcher.data?.rating,
    carWording,
    brokerFeeLines: reference.feeNames,
  });

  const draftSave = usePolicyDraftSave({
    policy,
    form,
    fieldsLocked,
    premiumRef,
    premiumManuallyEditedRef,
    premiumManualKeysRef,
    getDirtyPaths,
    commitSavedPaths,
    rollbackSavedPaths,
    refreshPremiumAfterSave,
    getLeaveApi,
    navigate,
  });
  const {
    hasUnsavedChanges,
    hasUnsavedChangesRef,
    setHasUnsavedChanges,
    saveStatus,
    savedSnapshotRef,
    persistDraft,
    saveDraftNow,
    handleFieldBlur,
    setDraftSaveError,
  } = draftSave;

  const submit = usePolicySubmit({
    policy,
    form,
    fetcher,
    step,
    premium,
    premiumRef,
    setPremium,
    setReferralReasons,
    regenerateDocumentsIfNeeded,
    formDataChangedForDocuments,
    goToStep,
    navigateToSection,
    firstIssuePath,
    findStepForField,
    pendingFocusPathRef,
    getLeaveApi,
    savedSnapshotRef,
    hasUnsavedChangesRef,
    setHasUnsavedChanges,
  });
  const {
    submitConfirmOpen,
    setSubmitConfirmOpen,
    submitting,
    submitDocumentNames,
    requestSubmit,
    confirmSubmit,
    savePolicy,
    confirmTerminalStatusAndSave,
  } = submit;

  const leave = usePolicyLeaveGuard({
    policy,
    readOnly,
    isNew,
    isFormTerminal,
    hasUnsavedChanges,
    hasUnsavedChangesRef,
    setHasUnsavedChanges,
    saveDraftNow,
    savePolicy,
    setDraftSaveError,
    fetcher,
  });
  useEffect(() => {
    leaveApiRef.current = leave;
  });

  const {
    pendingLeaveAfterSave,
    discarding,
    leaveDialogOpen,
    leaveWithoutSaving,
    saveAndLeave,
    stayOnPage,
    handleCancelClick,
  } = leave;

  // Status stays locked on drafts / new policies — changeable only after submit.
  const canChangeStatus =
    !policy.isDraft &&
    policy.policyStatusId === POLICY_STATUS.Pending &&
    !fieldsLocked;

  function handleSectionIssueCounter(sectionId: string) {
    navigateToSectionFirstIssue(sectionId);
    const paths = sectionIssuePaths[sectionId] ?? [];
    if (paths.length === 0) return;
    // Yellow attention — clear red invalid so the cue stays warning.
    for (const path of paths) {
      form.clearErrors(path as never);
    }
    markAttentionPaths(paths);
  }

  function handleNavigateToIssue(path: string) {
    navigateToIssue(path);
    // Same yellow border cue as section counters (not red invalid).
    form.clearErrors(path as never);
    markAttentionPaths([path]);
  }

  const wizardMode: WizardMode = isNew ? "new" : fieldsLocked ? "view" : "edit";

  // Submit enablement:
  // 1) form must pass carPolicySchema (`isFormValid` — see side-nav issue counts)
  // 2) after submit / when non-draft: require a change vs last submitted snapshot
  const { submitDisabled, setSubmittedFingerprint } =
    useCarPolicyWizardSubmitGate({
      form,
      premium,
      policyPremium: policy.car.premium,
      hasSubmittedOnce,
      isFormValid,
    });
  const submitBusy = submitting;
  usePolicyDraftKeyboardSave(fieldsLocked, saveDraftNow);

  const premiumPanelProps = {
    premium,
    referralReasons,
    isCalculating,
    documents,
    isGeneratingDocuments,
    policyNumber: policy.policyNumber,
    clientName,
    brokerName,
    brokerEmail,
    emailTemplates,
    emailDirectory,
    emailTemplateVars,
    footerImageWidth,
    policy,
    getPreviewPolicy: buildDocumentSnapshot,
    carWording,
    brokerFeeLines: reference.feeNames,
    className: wizardModeCardBorderClass(wizardMode),
  };

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
      <CarPolicyWizardHeader
        wizardMode={wizardMode}
        policyNumber={policy.policyNumber}
        clientId={policy.clientId}
        clientName={clientName}
        selectedStatus={selectedStatus}
        saveStatus={saveStatus}
        adjusted={Boolean(policy.car.adjusted)}
        headerActions={headerActions}
        readOnly={readOnly}
        isFormTerminal={isFormTerminal}
        submitDisabled={submitDisabled}
        submitBusy={submitBusy}
        onRequestSubmit={() => {
          void requestSubmit();
        }}
        navItems={navItems}
        activeSectionId={activeSectionId}
        onNavigateSection={navigateToSection}
        sectionIssueCounts={sectionIssueCounts}
        onNavigateToSectionFirstIssue={handleSectionIssueCounter}
      />

      <div className="grid min-h-0 flex-1 gap-6 px-4 pb-4 md:px-8 xl:grid-cols-[200px_minmax(0,1fr)_300px] xl:overflow-hidden xl:pb-4">
        <CarPolicyWizardDesktopRail
          wizardMode={wizardMode}
          isNew={isNew}
          navItems={navItems}
          activeSectionId={activeSectionId}
          openMap={openMap}
          onNavigateSection={navigateToSection}
          onToggleSection={(sectionId, open) => {
            setOpenMap((prev) => ({ ...prev, [sectionId]: open }));
          }}
          invalidIssues={invalidIssues}
          sectionIssueCounts={sectionIssueCounts}
          onNavigateToIssue={handleNavigateToIssue}
          onNavigateToSectionFirstIssue={handleSectionIssueCounter}
          notes={notes}
          noteAuthors={noteAuthors}
          policyIsDraft={Boolean(policy.isDraft)}
          onAddNote={addNote}
          onUpdateNote={updateNote}
          noteBusy={isSavingNote}
          noteError={noteError}
        />

        <div
          data-policy-form-scroll
          className="flex min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden xl:overflow-y-auto xl:overscroll-contain xl:[&>*]:shrink-0"
        >
          <CarPolicyWizardInformationCard
            policy={policy}
            reference={reference}
            insurerName={insurerName}
            selectedStatusId={
              selectedStatus?.policyStatusId ?? selectedStatusId
            }
            selectedStatusName={selectedStatus?.name ?? "Pending"}
            canChangeStatus={canChangeStatus}
            premium={premium}
            premiumRef={premiumRef}
            isFetcherBusy={isFetcherBusy}
            isCalculating={isCalculating}
            className={wizardModeCardBorderClass(wizardMode)}
            onConfirmTerminalStatus={confirmTerminalStatusAndSave}
            onOpenPremiumSection={() => {
              setOpenMap((prev) => ({ ...prev, premium: true }));
              navigateToSection("premium");
            }}
            onMarkAttentionPaths={markAttentionPaths}
          />

          <div className="xl:hidden">
            <CarPolicyWizardPremiumPanel documentsOnly {...premiumPanelProps} />
          </div>

          {!isNew ? (
            <div className="xl:hidden">
              <CarPolicyWizardMobileNotes
                wizardMode={wizardMode}
                notes={notes}
                noteAuthors={noteAuthors}
                policyIsDraft={Boolean(policy.isDraft)}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                noteBusy={isSavingNote}
                noteError={noteError}
              />
            </div>
          ) : null}

          <WizardSectionStack
            premiumPinned={premiumPinned}
            openMap={openMap}
            setOpenMap={setOpenMap}
            reference={reference}
            carWording={carWording}
            premium={premium}
            referralReasons={referralReasons}
            notes={notes}
            fieldsLocked={fieldsLocked}
            policy={policy}
            rating={fetcher.data?.rating ?? policy.car.rating}
            premiumManuallyEditedRef={premiumManuallyEditedRef}
            premiumManualKeysRef={premiumManualKeysRef}
            premiumRef={premiumRef}
            setPremium={setPremium}
            hasUnsavedChangesRef={hasUnsavedChangesRef}
            setHasUnsavedChanges={setHasUnsavedChanges}
            persistDraft={persistDraft}
            handleFieldBlur={handleFieldBlur}
            onResetPremium={resetManualPremium}
            isCalculating={isCalculating}
            onExportExcel={() => {
              void exportPremiumExcel();
            }}
            isExportingExcel={isExportingExcel}
            shellCardClassName={wizardModeCardBorderClass(wizardMode)}
          />

          <WizardFormFooter
            readOnly={readOnly}
            isFormTerminal={isFormTerminal}
            actionData={fetcher.data}
            onCancel={handleCancelClick}
            onSubmit={() => {
              void requestSubmit();
            }}
            submitBusy={submitBusy}
            submitDisabled={submitDisabled}
          />
        </div>

        <aside className={cn("hidden xl:block", POLICY_STICKY_RAIL_CLASS)}>
          <CarPolicyWizardPremiumPanel
            {...premiumPanelProps}
            adjustment={policy.car.adjusted ? policy.car.adjustment : undefined}
          />
        </aside>
      </div>

      <CarPolicyWizardDialogs
        submitConfirmOpen={submitConfirmOpen}
        onSubmitConfirmOpenChange={setSubmitConfirmOpen}
        submitDocumentNames={submitDocumentNames}
        submitBusy={submitBusy}
        onSubmitConfirm={() => {
          void confirmSubmit().then((ok) => {
            if (!ok) return;
            setSubmittedInSession(true);
            setSubmittedFingerprint(
              JSON.stringify({
                values: form.getValues(),
                premium: premiumRef.current ?? premium ?? null,
              }),
            );
          });
        }}
        leaveDialogOpen={leaveDialogOpen}
        isNew={isNew}
        pendingLeaveAfterSave={pendingLeaveAfterSave}
        discarding={discarding}
        onStay={stayOnPage}
        onLeaveWithoutSaving={leaveWithoutSaving}
        onSaveAndLeave={saveAndLeave}
      />
    </div>
  );
}
