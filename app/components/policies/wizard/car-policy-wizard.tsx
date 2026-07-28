import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFetcher, useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
  useFormContext,
  type Resolver,
} from "react-hook-form";
import { CircleCheckIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/reui/badge";
import { Button } from "~/components/ui/button";
import { StatusBadge } from "~/components/ui/status-badge";
import { PremiumSummaryPanel } from "./sections";
import { LeaveDiscardDialog, SubmitConfirmDialog } from "./dialogs";
import { WizardFormFooter } from "./form-footer";
import { MobileSectionNav, WizardSectionStack } from "./section-stack";
import {
  POLICY_FORM_SECTIONS,
  POLICY_STICKY_RAIL_CLASS,
  PolicyInformationCard,
  PolicySectionNav,
  PolicyStickyHeader,
  getPolicyFormNavItems,
} from "~/components/policies/policy-form-layout";
import {
  POLICY_STATUS,
  carPolicySchema,
  isTerminalStatus,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import type { CarWording, Policy, ReferenceData } from "~/lib/db/types";
import type { EmailTemplate } from "~/lib/email-templates";
import type { NoteAuthor } from "~/lib/services/users/service";
import {
  JustSavedProvider,
  PolicySaveStatusBadge,
  useJustSaved,
} from "~/components/forms/field-save-highlight";
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
  if (mode === "new") {
    return "border-l-4 border-l-primary";
  }
  if (mode === "edit") {
    return "border-l-4 border-l-warning";
  }
  return "border-l-4 border-l-success";
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
  headerActions,
}: CarPolicyWizardProps) {
  const form = useFormContext<CarPolicyFormValues>();
  // Subscribe so post-trigger reads of formState.errors are current.
  void form.formState.errors;
  const { commitSavedPaths, rollbackSavedPaths, getDirtyPaths } =
    useJustSaved();

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
  /** Pin Premium under Policy Information only once status is Taken. */
  const premiumPinned = selectedStatusId === POLICY_STATUS.Taken;
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
    firstIssuePath,
    findStepForField,
    invalidIssues,
    step,
  } = navigation;

  const { notes, noteAuthors, addNote, addNoteError, isAddingNote } =
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
    refreshPremiumAfterSave,
  } = premiumCalc;

  const {
    documents,
    isGeneratingDocuments,
    showDocsGeneratedAlert,
    regenerateDocumentsIfNeeded,
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
    manualSaving,
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
    goToStep,
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

  const canChangeStatus =
    policy.policyStatusId === POLICY_STATUS.Pending && !fieldsLocked;
  const allSectionsOpen = POLICY_FORM_SECTIONS.every((s) => openMap[s.id]);
  const submitBusy = submitting || isGeneratingDocuments;
  const wizardMode: WizardMode = isNew ? "new" : fieldsLocked ? "view" : "edit";

  return (
    <div
      className={cn(
        "-mx-4 -mt-4 flex flex-col gap-4 md:-mx-8 md:-mt-8",
        wizardMode === "view" &&
          "[&_[data-slot=card]]:bg-muted/40 [&_input]:bg-muted/30 [&_select]:bg-muted/30 [&_textarea]:bg-muted/30",
      )}
      data-wizard-mode={wizardMode}
    >
      <PolicyStickyHeader
        policyNumber={policy.policyNumber}
        clientId={policy.clientId}
        clientName={clientName || "Client"}
        className={wizardModeHeaderClass(wizardMode)}
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const next = !allSectionsOpen;
              setOpenMap(
                Object.fromEntries(
                  POLICY_FORM_SECTIONS.map((s) => [s.id, next]),
                ),
              );
            }}
          >
            {allSectionsOpen ? "Collapse all" : "Expand all"}
          </Button>
        }
      />

      {showDocsGeneratedAlert ? (
        <Alert variant="success" className="mx-4 md:mx-8">
          <CircleCheckIcon />
          <AlertTitle>Documents generated</AlertTitle>
          <AlertDescription>
            Policy PDFs are ready. Open or download them from Premium Summary.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 px-4 md:px-8 xl:grid-cols-[200px_minmax(0,1fr)_280px]">
        <aside className={cn("hidden xl:block", POLICY_STICKY_RAIL_CLASS)}>
          <PolicySectionNav
            activeId={activeSectionId}
            openMap={openMap}
            onNavigate={navigateToSection}
            invalidIssues={invalidIssues}
            onNavigateToIssue={navigateToIssue}
            items={navItems}
            className={wizardModeHeaderClass(wizardMode)}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <MobileSectionNav
            items={navItems}
            activeSectionId={activeSectionId}
            onNavigate={navigateToSection}
          />

          <PolicyInformationCard
            insurerName={insurerName}
            policyNumber={policy.policyNumber}
            statusId={selectedStatus?.policyStatusId ?? selectedStatusId}
            statusName={selectedStatus?.name ?? "Pending"}
            adjusted={Boolean(policy.car.adjusted)}
            notes={notes}
            noteAuthors={noteAuthors}
            showNotes={!policy.isDraft}
            canAddNotes={!policy.isDraft}
            onAddNote={addNote}
            addNoteBusy={isAddingNote}
            addNoteError={addNoteError}
            className={wizardModeCardBorderClass(wizardMode)}
          />

          <WizardSectionStack
            premiumPinned={premiumPinned}
            openMap={openMap}
            setOpenMap={setOpenMap}
            reference={reference}
            carWording={carWording}
            premium={premium}
            referralReasons={referralReasons}
            notes={notes}
            canChangeStatus={canChangeStatus}
            onConfirmTerminalStatus={confirmTerminalStatusAndSave}
            confirmBusy={isFetcherBusy && !isCalculating}
            fieldsLocked={fieldsLocked}
            policy={policy}
            premiumManuallyEditedRef={premiumManuallyEditedRef}
            premiumRef={premiumRef}
            setPremium={setPremium}
            hasUnsavedChangesRef={hasUnsavedChangesRef}
            setHasUnsavedChanges={setHasUnsavedChanges}
            persistDraft={persistDraft}
            handleFieldBlur={handleFieldBlur}
            shellCardClassName={wizardModeCardBorderClass(wizardMode)}
          />

          <WizardFormFooter
            readOnly={readOnly}
            isFormTerminal={isFormTerminal}
            actionData={fetcher.data}
            onCancel={handleCancelClick}
            onSave={saveDraftNow}
            onSubmit={() => {
              void requestSubmit();
            }}
            manualSaving={manualSaving}
            submitBusy={submitBusy}
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
            policy={policy}
            adjustment={policy.car.adjusted ? policy.car.adjustment : undefined}
            className={cn(
              // Sticky rail overflow clips Card ring (box-shadow); use a real border.
              "border border-border",
              wizardModeCardBorderClass(wizardMode),
            )}
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
          void confirmSubmit();
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
