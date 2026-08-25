import type { CarWording } from "~/lib/db/types";

import type { usePolicyDocuments } from "../hooks/composite/use-documents";
import type { usePolicyDraftSave } from "../hooks/composite/use-draft-save";
import type { usePolicyWizardNavigation } from "../hooks/composite/use-navigation";
import type { usePolicyPremiumCalc } from "../hooks/composite/use-premium-calc";
import type { usePolicySubmit } from "../hooks/composite/use-submit";
import type { useWizardCore, WizardStateProps } from "./use-wizard-core";

type Core = ReturnType<typeof useWizardCore>;
type Navigation = ReturnType<typeof usePolicyWizardNavigation>;
type PremiumCalc = ReturnType<typeof usePolicyPremiumCalc>;
type Documents = ReturnType<typeof usePolicyDocuments>;
type DraftSave = ReturnType<typeof usePolicyDraftSave>;
type Submit = ReturnType<typeof usePolicySubmit>;

export function navigationInput(core: Core, props: WizardStateProps) {
  return {
    policyId: props.policy.policyId,
    form: core.form,
    values: core.deferredValues,
    policyPremium: props.policy.car.premium,
    isDraft: Boolean(props.policy.isDraft),
    navIds: core.navIds,
  };
}

export function notesInput(core: Core, props: WizardStateProps) {
  return {
    policy: props.policy,
    noteAuthors: props.noteAuthors,
    fetcher: core.fetcher,
  };
}

export function premiumInput(
  core: Core,
  navigation: Navigation,
  props: WizardStateProps,
) {
  return {
    policy: props.policy,
    form: core.form,
    fetcher: core.fetcher,
    premiumSectionOpen: navigation.openMap.premium ?? true,
  };
}

export function documentsInput(
  core: Core,
  premiumCalc: PremiumCalc,
  props: WizardStateProps,
  carWording: CarWording[],
) {
  return {
    policy: props.policy,
    form: core.form,
    premium: premiumCalc.premium,
    premiumRef: premiumCalc.premiumRef,
    premiumManualKeysRef: premiumCalc.premiumManualKeysRef,
    referralReasons: premiumCalc.referralReasons,
    rating: core.fetcher.data?.rating,
    carWording,
    brokerFeeLines: props.reference.feeNames,
  };
}

export function draftInput(
  core: Core,
  premiumCalc: PremiumCalc,
  props: WizardStateProps,
) {
  return {
    policy: props.policy,
    form: core.form,
    premiumRef: premiumCalc.premiumRef,
    premiumManuallyEditedRef: premiumCalc.premiumManuallyEditedRef,
    premiumManualKeysRef: premiumCalc.premiumManualKeysRef,
    getDirtyPaths: core.justSaved.getDirtyPaths,
    commitSavedPaths: core.justSaved.commitSavedPaths,
    rollbackSavedPaths: core.justSaved.rollbackSavedPaths,
    refreshPremiumAfterSave: premiumCalc.refreshPremiumAfterSave,
    getLeaveApi: core.getLeaveApi,
    navigate: core.navigate,
    draftSaveSyncRef: premiumCalc.draftSaveSyncRef,
  };
}

export function submitInput(options: {
  core: Core;
  navigation: Navigation;
  premiumCalc: PremiumCalc;
  documents: Documents;
  draftSave: DraftSave;
  props: WizardStateProps;
}) {
  const { core, navigation, premiumCalc, documents, draftSave, props } =
    options;
  return {
    policy: props.policy,
    form: core.form,
    fetcher: core.fetcher,
    step: navigation.step,
    premium: premiumCalc.premium,
    premiumRef: premiumCalc.premiumRef,
    regenerateDocumentsIfNeeded: documents.regenerateDocumentsIfNeeded,
    formDataChangedForDocuments: documents.formDataChangedForDocuments,
    goToStep: navigation.goToStep,
    navigateToSection: navigation.navigateToSection,
    firstIssuePath: navigation.firstIssuePath,
    findStepForField: navigation.findStepForField,
    pendingFocusPathRef: navigation.pendingFocusPathRef,
    getLeaveApi: core.getLeaveApi,
    savedSnapshotRef: draftSave.savedSnapshotRef,
    hasUnsavedChangesRef: draftSave.hasUnsavedChangesRef,
    setHasUnsavedChanges: draftSave.setHasUnsavedChanges,
    cancelQueuedDraftSave: draftSave.cancelQueuedDraftSave,
    waitForDraftIdle: draftSave.waitForDraftIdle,
  };
}

export function leaveInput(options: {
  core: Core;
  draftSave: DraftSave;
  submit: Submit;
  props: WizardStateProps;
}) {
  const { core, draftSave, submit, props } = options;
  return {
    policy: props.policy,
    hasUnsavedChanges: draftSave.hasUnsavedChanges,
    hasUnsavedChangesRef: draftSave.hasUnsavedChangesRef,
    setHasUnsavedChanges: draftSave.setHasUnsavedChanges,
    saveDraftNow: draftSave.saveDraftNow,
    savePolicy: submit.savePolicy,
    setDraftSaveError: draftSave.setDraftSaveError,
    fetcher: core.fetcher,
    leaveApiRef: core.leaveApiRef,
  };
}

export function gateInput(
  core: Core,
  premiumCalc: PremiumCalc,
  navigation: Navigation,
  props: WizardStateProps,
) {
  return {
    values: core.deferredValues,
    premium: premiumCalc.premium,
    policyPremium: props.policy.car.premium,
    premiumPinned: core.phase.premiumPinned,
    isFormValid: navigation.isFormValid,
  };
}
