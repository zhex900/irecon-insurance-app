import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useFormContext } from "react-hook-form";

import { getPolicyFormNavItems } from "~/components/policies/policy-form-layout";
import { POLICY_STATUS, type CarPolicyFormValues } from "~/lib/zod/policy-car";
import { useJustSaved } from "~/components/forms/field-save-highlight";

import { usePolicyNotes } from "../hooks/use-notes";
import { usePolicyDocuments } from "../hooks/use-documents";
import {
  usePolicyPremiumCalc,
  type PolicyWizardActionData,
} from "../hooks/use-premium-calc";
import { usePolicyWizardNavigation } from "../hooks/use-navigation";
import {
  usePolicyDraftSave,
  type PolicyLeaveApi,
} from "../hooks/use-draft-save";
import { usePolicySubmit } from "../hooks/use-submit";
import { usePolicyLeaveGuard } from "../hooks/use-leave-guard";
import { useCarPolicyWizardSubmitGate } from "../hooks/use-submit-gate";
import { usePolicyDraftKeyboardSave } from "../hooks/use-draft-keyboard-save";
import {
  wizardModeCardBorderClass,
  type WizardProps,
} from "../shared/shared";
import { useMode } from "../hooks/use-mode";

/**
 * CarPolicyWizard state hook that contains all the logic from the original component
 * This separates state and logic from UI rendering
 */
export function useWizardState({
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
  headerActions: _headerActions,
}: Omit<WizardProps, "readOnly" | "isNew" | "freshSteps"> & {
  headerActions?: ReactNode;
}) {
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
    (item: { policyStatusId: number }) => item.policyStatusId === selectedStatusId,
  );
  const livePolicyNumber =
    form.watch("policyNumber")?.trim() || policy.policyNumber;
  const coverTypeId =
    Number(form.watch("coverTypeId")) || policy.car.coverTypeId;
  const coverTypeName =
    reference.coverTypes.find((item: { coverTypeId: number }) => item.coverTypeId === coverTypeId)
      ?.name ?? "";
  const insurerCode = form.watch("insurerCode");
  const insurerName =
    reference.insurers.find((item: { code: string }) => item.code === insurerCode)?.name ??
    insurerCode;

  const { fieldsLocked, isNew, wizardMode, premiumPinned } =
    useMode();

  /**
   * After the first successful Submit, keep Submit off until values change again.
   * Draft autosave must NOT clear this — only a successful Submit resets it.
   * Also keeps Premium pinned under Policy Information (do not move it back).
   */
  /** Session submit, or already non-draft — pins Premium and gates re-submit. */
  const [submittedInSession, setSubmittedInSession] = useState(false);
  const hasSubmittedOnce = submittedInSession || !policy.isDraft;
  const navItems = useMemo(
    () => getPolicyFormNavItems(premiumPinned),
    [premiumPinned],
  );
  const navIds = useMemo(() => navItems.map((item: { id: string }) => item.id), [navItems]);

  const navigation = usePolicyWizardNavigation({
    policyId: policy.policyId,
    form,
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
    premiumRef,
    premiumManualKeysRef,
    referralReasons,
    rating: fetcher.data?.rating,
    carWording,
    brokerFeeLines: reference.feeNames,
  });

  const draftSave = usePolicyDraftSave({
    policy,
    form,
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
      form.clearErrors(path as keyof CarPolicyFormValues);
    }
    markAttentionPaths(paths);
  }

  function handleNavigateToIssue(path: string) {
    navigateToIssue(path);
    // Same yellow border cue as section counters (not red invalid).
    form.clearErrors(path as keyof CarPolicyFormValues);
    markAttentionPaths([path]);
  }

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
  usePolicyDraftKeyboardSave(saveDraftNow);

  // Memoize the border class to avoid recomputation
  const borderClassName = useMemo(
    () => wizardModeCardBorderClass(wizardMode),
    [wizardMode],
  );

  const premiumPanelProps = {
    premium,
    referralReasons,
    isCalculating,
    documents,
    isGeneratingDocuments,
    policyNumber: livePolicyNumber,
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
    className: borderClassName,
  };

  return {
    // Form state
    form,
    fetcher,

    // State helpers from useJustSaved
    markAttentionPaths,

    // UI state
    selectedStatus,
    livePolicyNumber,
    coverTypeName,
    insurerName,
    fieldsLocked,
    isNew,
    wizardMode,
    premiumPinned,
    hasSubmittedOnce,
    submittedInSession,
    setSubmittedInSession,

    // Navigation
    navItems,
    activeSectionId,
    openMap,
    setOpenMap,
    navigation,
    invalidIssues,
    sectionIssueCounts,
    sectionIssuePaths,

    // Notes
    notes,
    noteAuthors,
    addNote,
    updateNote,
    noteError,
    isSavingNote,

    // Premium
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

    // Documents
    documents,
    isGeneratingDocuments,
    isExportingExcel,
    exportPremiumExcel,
    regenerateDocumentsIfNeeded,
    formDataChangedForDocuments,
    buildDocumentSnapshot,

    // Draft save
    hasUnsavedChanges,
    hasUnsavedChangesRef,
    setHasUnsavedChanges,
    saveStatus,
    savedSnapshotRef,
    persistDraft,
    saveDraftNow,
    handleFieldBlur,
    setDraftSaveError,

    // Submit
    submitConfirmOpen,
    setSubmitConfirmOpen,
    submitting,
    submitDocumentNames,
    requestSubmit,
    confirmSubmit,
    savePolicy,
    confirmTerminalStatusAndSave,
    submitDisabled,
    submitBusy,
    setSubmittedFingerprint,

    // Leave guard
    pendingLeaveAfterSave,
    discarding,
    leaveDialogOpen,
    leaveWithoutSaving,
    saveAndLeave,
    stayOnPage,
    handleCancelClick,

    // Helpers
    canChangeStatus,
    handleSectionIssueCounter,
    handleNavigateToIssue,
    borderClassName,
    premiumPanelProps,
    getLeaveApi,
  };
}

export type CarPolicyWizardState = ReturnType<typeof useCarPolicyWizardSubmitGate>;
