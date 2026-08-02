import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFetcher, useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
  useFormContext,
  type Resolver,
} from "react-hook-form";
import { Badge } from "~/components/reui/badge";
import { LoadingButton } from "~/components/ui/loading-button";
import { StatusBadge } from "~/components/ui/status-badge";
import { PremiumSummaryPanel } from "./sections";
import { LeaveDiscardDialog, SubmitConfirmDialog } from "./dialogs";
import { WizardFormFooter } from "./form-footer";
import { MobileSectionNav, WizardSectionStack } from "./section-stack";
import {
  POLICY_STICKY_RAIL_CLASS,
  PolicyInformationCard,
  PolicySectionNav,
  PolicyStickyHeader,
  getPolicyFormNavItems,
} from "~/components/policies/policy-form-layout";
import { PolicyNotesCard } from "~/components/policies/policy-notes-card";
import {
  POLICY_STATUS,
  carPolicySchema,
  isTerminalStatus,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import type { CarWording, Policy, ReferenceData } from "~/lib/db/types";
import type { EmailTemplate, EmailTemplateVars } from "~/lib/email-templates";
import type { EmailDirectoryEntry } from "~/lib/email/directory";
import type { NoteAuthor } from "~/lib/services/users/service";
import {
  JustSavedProvider,
  PolicySaveStatusBadge,
  useJustSaved,
} from "~/components/forms/field-save-highlight";
import { getTakenStatusIssues } from "~/lib/policy-taken-status";
import { cn } from "~/lib/utils";
import { policyToFormValues } from "./policy-to-form-values";
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

type WizardMode = "new" | "edit" | "view";

function wizardModeBadge(mode: WizardMode) {
  if (mode === "new") {
    return (
      <Badge variant="primary-light" radius="full">
        New
      </Badge>
    );
  }
  if (mode === "edit") {
    return (
      <Badge variant="warning-light" radius="full">
        Editing
      </Badge>
    );
  }
  return (
    <Badge variant="success-light" radius="full">
      View only
    </Badge>
  );
}

function wizardModeHeaderClass(mode: WizardMode) {
  if (mode === "new") {
    return "border-l-4 border-l-primary bg-primary/[0.06]";
  }
  if (mode === "edit") {
    return "border-l-4 border-l-warning bg-warning/[0.1]";
  }
  return "border-l-4 border-l-success bg-success/[0.08]";
}

function wizardModeCardBorderClass(mode: WizardMode) {
  // Real border (not ring) — overflow on rails/scroll areas clips Card ring.
  if (mode === "new") {
    return "border border-border border-l-4 border-l-primary";
  }
  if (mode === "edit") {
    return "border border-border border-l-4 border-l-warning";
  }
  return "border border-border border-l-4 border-l-success";
}

type CarPolicyWizardProps = {
  policy: Policy;
  reference: ReferenceData;
  carWording: CarWording[];
  readOnly?: boolean;
  /** Start at step 1 with no completed/unlocked steps (e.g. after clone). */
  freshSteps?: boolean;
  /** Created via /policies/new — discard on leave without saving. */
  isNew?: boolean;
  clientName?: string;
  brokerName?: string;
  brokerEmail?: string;
  noteAuthors?: Record<string, NoteAuthor>;
  emailTemplates?: EmailTemplate[];
  emailDirectory?: EmailDirectoryEntry[];
  emailTemplateVars?: EmailTemplateVars;
  footerImageWidth?: number;
  headerActions?: ReactNode;
};

export function CarPolicyWizard({
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
  const form = useForm<CarPolicyFormValues>({
    resolver: zodResolver(carPolicySchema) as Resolver<CarPolicyFormValues>,
    defaultValues: {
      ...policyToFormValues(policy),
      // New policies: force empty Yes/No + Section 1 amounts (do not show $0).
      ...(isNew
        ? {
            hasExistingContractWorksCover: "" as unknown as boolean,
            contractWorksSumInsured: "" as unknown as number,
            displayHomes: "" as unknown as number,
            existingStructure: "" as unknown as number,
            plantEquipment: "" as unknown as number,
            estimatedTurnover: "" as unknown as number,
            claimsCountLast3Years: "" as unknown as number,
            anyClaimsExceed20k: "" as unknown as boolean,
            stateId: "" as unknown as number,
            liabilityLimitBand: "" as unknown as number,
            section1DisplayHomes: "" as unknown as number,
            section1ExistingStructure: "" as unknown as number,
          }
        : {}),
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  return (
    <FormProvider {...form}>
      <JustSavedProvider>
        <CarPolicyWizardInner
          policy={policy}
          reference={reference}
          carWording={carWording}
          readOnly={readOnly}
          freshSteps={freshSteps}
          isNew={isNew}
          clientName={clientName}
          brokerName={brokerName}
          brokerEmail={brokerEmail}
          noteAuthors={initialNoteAuthors}
          emailTemplates={emailTemplates}
          emailDirectory={emailDirectory}
          emailTemplateVars={emailTemplateVars}
          footerImageWidth={footerImageWidth}
          headerActions={headerActions}
        />
      </JustSavedProvider>
    </FormProvider>
  );
}

function CarPolicyWizardInner({
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
    referralReasons,
    setReferralReasons,
    isFetcherBusy,
    isCalculating,
    recalculatePremium,
    refreshPremiumAfterSave,
  } = premiumCalc;

  const {
    documents,
    isGeneratingDocuments,
    regenerateDocumentsIfNeeded,
    formDataChangedForDocuments,
    buildDocumentSnapshot,
  } = usePolicyDocuments({
    policy,
    form,
    premium,
    referralReasons,
    rating: fetcher.data?.rating,
  });

  const draftSave = usePolicyDraftSave({
    policy,
    form,
    fieldsLocked,
    premiumRef,
    premiumManuallyEditedRef,
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

  const submitBusy = submitting || isGeneratingDocuments;
  const wizardMode: WizardMode = isNew ? "new" : fieldsLocked ? "view" : "edit";
  const formValues = form.watch();
  const submitFingerprint = useMemo(
    () => JSON.stringify({ values: formValues, premium: premium ?? null }),
    [formValues, premium],
  );
  const [submittedFingerprint, setSubmittedFingerprint] =
    useState(submitFingerprint);
  const hasChangesSinceSubmit = submitFingerprint !== submittedFingerprint;
  const submitDisabled =
    !isFormValid || (hasSubmittedOnce && !hasChangesSinceSubmit);
  const saveDraftNowRef = useRef(saveDraftNow);

  useEffect(() => {
    saveDraftNowRef.current = saveDraftNow;
  }, [saveDraftNow]);

  // Cmd/Ctrl+S — same draft save path as blur autosave (toast on success).
  useEffect(() => {
    if (fieldsLocked) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "s") return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      event.preventDefault();
      saveDraftNowRef.current();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fieldsLocked]);

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
      {/* Header + mobile section nav share one sticky stack under the app bar. */}
      <div
        className={cn(
          "sticky top-14 z-20 shrink-0 border-b border-border backdrop-blur",
          "xl:static xl:backdrop-blur-none",
          wizardModeHeaderClass(wizardMode),
        )}
      >
        <PolicyStickyHeader
          policyNumber={policy.policyNumber}
          clientId={policy.clientId}
          clientName={clientName || "Client"}
          className="static border-0 bg-transparent backdrop-blur-none"
          modeBadge={wizardModeBadge(wizardMode)}
          breadcrumbs={[
            { label: "Clients", to: "/clients" },
            {
              label: clientName || "Client",
              to: `/clients/${policy.clientId}`,
            },
            { label: policy.policyNumber },
          ]}
          statusBadge={
            selectedStatus ? (
              <StatusBadge
                statusId={selectedStatus.policyStatusId}
                name={selectedStatus.name}
              />
            ) : null
          }
          saveStatus={
            wizardMode !== "view" ? (
              <PolicySaveStatusBadge status={saveStatus} />
            ) : null
          }
          adjusted={Boolean(policy.car.adjusted)}
          actions={headerActions}
          expandControl={
            !readOnly && !isFormTerminal ? (
              <LoadingButton
                type="button"
                size="sm"
                disabled={submitDisabled}
                onClick={() => {
                  void requestSubmit();
                }}
                loading={submitBusy}
                loadingLabel="Submitting…"
              >
                Submit
              </LoadingButton>
            ) : null
          }
        />
        <div className="border-t border-border px-4 py-2 md:px-8 xl:hidden">
          <MobileSectionNav
            items={navItems}
            activeSectionId={activeSectionId}
            onNavigate={navigateToSection}
            sectionIssueCounts={sectionIssueCounts}
            onNavigateToSectionFirstIssue={handleSectionIssueCounter}
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 px-4 pb-4 md:px-8 xl:grid-cols-[200px_minmax(0,1fr)_300px] xl:overflow-hidden xl:pb-4">
        <aside className="hidden min-h-0 xl:flex xl:h-full xl:flex-col xl:gap-4 xl:overflow-hidden">
          <div className="shrink-0">
            <PolicySectionNav
              activeId={activeSectionId}
              openMap={openMap}
              onNavigate={navigateToSection}
              onToggleSection={(sectionId, open) => {
                setOpenMap((prev) => ({ ...prev, [sectionId]: open }));
              }}
              invalidIssues={invalidIssues}
              sectionIssueCounts={sectionIssueCounts}
              onNavigateToIssue={navigateToIssue}
              onNavigateToSectionFirstIssue={handleSectionIssueCounter}
              items={navItems}
              className={wizardModeCardBorderClass(wizardMode)}
            />
          </div>
          {!isNew ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <PolicyNotesCard
                notes={notes}
                noteAuthors={noteAuthors}
                canAddNotes={!policy.isDraft}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                noteBusy={isSavingNote}
                noteError={noteError}
                className={wizardModeCardBorderClass(wizardMode)}
              />
            </div>
          ) : null}
        </aside>

        <div
          data-policy-form-scroll
          className="flex min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden xl:overflow-y-auto xl:overscroll-contain xl:[&>*]:shrink-0"
        >
          <PolicyInformationCard
            insurerName={insurerName}
            policyNumber={policy.policyNumber}
            statusId={selectedStatus?.policyStatusId ?? selectedStatusId}
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
              const values = form.getValues();
              const currentPremium = premiumRef.current ?? premium;
              const issues = getTakenStatusIssues(values, {
                contractWorksExistingStructurePremium:
                  currentPremium?.contractWorksExistingStructurePremium ?? 0,
                contractWorksPlantPremium:
                  currentPremium?.contractWorksPlantPremium ?? 0,
              });
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
              const values = form.getValues();
              const currentPremium = premiumRef.current ?? premium;
              const issues = getTakenStatusIssues(values, {
                contractWorksExistingStructurePremium:
                  currentPremium?.contractWorksExistingStructurePremium ?? 0,
                contractWorksPlantPremium:
                  currentPremium?.contractWorksPlantPremium ?? 0,
              });
              const keys = issues.map((issue) => issue.premiumKey);
              setOpenMap((prev) => ({ ...prev, premium: true }));
              navigateToSection("premium");
              // Open the section first, then pulse so the row is mounted/visible.
              window.setTimeout(() => {
                markAttentionPaths(keys);
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
            className={wizardModeCardBorderClass(wizardMode)}
          />

          <div className="xl:hidden">
            <PremiumSummaryPanel
              documentsOnly
              premium={premium}
              documents={documents}
              isGeneratingDocuments={isGeneratingDocuments}
              policyNumber={policy.policyNumber}
              clientName={clientName}
              brokerName={brokerName}
              brokerEmail={brokerEmail}
              emailTemplates={emailTemplates}
              emailDirectory={emailDirectory}
              emailTemplateVars={emailTemplateVars}
              footerImageWidth={footerImageWidth}
              policy={policy}
              getPreviewPolicy={buildDocumentSnapshot}
              className={wizardModeCardBorderClass(wizardMode)}
            />
          </div>

          {!isNew ? (
            <div className="xl:hidden">
              <PolicyNotesCard
                notes={notes}
                noteAuthors={noteAuthors}
                canAddNotes={!policy.isDraft}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                noteBusy={isSavingNote}
                noteError={noteError}
                className={wizardModeCardBorderClass(wizardMode)}
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
            premiumRef={premiumRef}
            setPremium={setPremium}
            hasUnsavedChangesRef={hasUnsavedChangesRef}
            setHasUnsavedChanges={setHasUnsavedChanges}
            persistDraft={persistDraft}
            handleFieldBlur={handleFieldBlur}
            onRecalculatePremium={recalculatePremium}
            isCalculating={isCalculating}
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
          <PremiumSummaryPanel
            premium={premium}
            referralReasons={referralReasons}
            isCalculating={isCalculating}
            documents={documents}
            isGeneratingDocuments={isGeneratingDocuments}
            policyNumber={policy.policyNumber}
            clientName={clientName}
            brokerName={brokerName}
            brokerEmail={brokerEmail}
            emailTemplates={emailTemplates}
            emailDirectory={emailDirectory}
            emailTemplateVars={emailTemplateVars}
            footerImageWidth={footerImageWidth}
            policy={policy}
            getPreviewPolicy={buildDocumentSnapshot}
            adjustment={policy.car.adjusted ? policy.car.adjustment : undefined}
            className={wizardModeCardBorderClass(wizardMode)}
          />
        </aside>
      </div>

      <SubmitConfirmDialog
        open={submitConfirmOpen}
        onOpenChange={setSubmitConfirmOpen}
        documentNames={submitDocumentNames}
        busy={submitBusy}
        onCancel={() => setSubmitConfirmOpen(false)}
        onConfirm={() => {
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
      />

      <LeaveDiscardDialog
        open={leaveDialogOpen}
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
