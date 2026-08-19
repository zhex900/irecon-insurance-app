import { useCallback, useMemo } from "react";

import { useCarWording } from "~/hooks/policy";

import {
  usePolicyDocuments,
  usePolicyDraftSave,
  usePolicyLeaveGuard,
  usePolicyPremiumCalc,
  usePolicySubmit,
  usePolicyWizardNavigation,
} from "../hooks";
import { usePolicyDraftKeyboardSave } from "../hooks/draft/use-draft-keyboard";
import { useCarPolicyWizardSubmitGate } from "../hooks/utils/use-submit-gate";
import {
  buildPremiumPanelProps,
  canChangeWizardStatus,
  createIssueAttentionHandlers,
  wizardBorderClassName,
  type WizardStateParts,
} from "./assemble-wizard-state";
import { useWizardCore, type WizardStateProps } from "./use-wizard-core";
import {
  documentsInput,
  draftInput,
  gateInput,
  leaveInput,
  navigationInput,
  premiumInput,
  submitInput,
} from "./wizard-state-inputs";

export function useWizardState(
  props: WizardStateProps,
  core: ReturnType<typeof useWizardCore>,
) {
  const navigation = usePolicyWizardNavigation(navigationInput(core, props));
  const claimsSectionOpen = navigation.openMap.claims ?? false;
  const hasSelectedWording =
    (props.policy.car.selectedWordingIds?.length ?? 0) > 0;
  const { carWording } = useCarWording(claimsSectionOpen || hasSelectedWording);
  const premiumCalc = usePolicyPremiumCalc(
    premiumInput(core, navigation, props),
  );
  const documents = usePolicyDocuments(
    documentsInput(core, premiumCalc, props, carWording),
  );
  const draftSave = usePolicyDraftSave(draftInput(core, premiumCalc, props));
  const submit = usePolicySubmit(
    submitInput({ core, navigation, premiumCalc, documents, draftSave, props }),
  );
  const leave = usePolicyLeaveGuard(
    leaveInput({ core, draftSave, submit, props }),
  );
  const gate = useCarPolicyWizardSubmitGate(
    gateInput(core, premiumCalc, navigation, props),
  );
  usePolicyDraftKeyboardSave(draftSave.saveDraftNow);

  const parts: WizardStateParts = useMemo(
    () => ({
      props,
      core,
      navigation,
      premiumCalc,
      documents,
      draftSave,
      submit,
      leave,
      gate,
    }),
    [
      props,
      core,
      navigation,
      premiumCalc,
      documents,
      draftSave,
      submit,
      leave,
      gate,
    ],
  );

  const borderClassName = wizardBorderClassName(parts);

  const premiumPanelProps = useMemo(
    () => buildPremiumPanelProps(parts, borderClassName, carWording),
    [parts, borderClassName, carWording],
  );

  const issueHandlers = useMemo(
    () =>
      createIssueAttentionHandlers({
        form: core.form,
        markAttentionPaths: core.justSaved.markAttentionPaths,
        navigateToIssue: navigation.navigateToIssue,
        navigateToSectionFirstIssue: navigation.navigateToSectionFirstIssue,
        sectionIssuePaths: navigation.sectionIssuePaths,
      }),
    [
      core.form,
      core.justSaved.markAttentionPaths,
      navigation.navigateToIssue,
      navigation.navigateToSectionFirstIssue,
      navigation.sectionIssuePaths,
    ],
  );

  const exportPremiumExcel = useCallback(async () => {
    await draftSave.saveDraftNow();
    await documents.exportPremiumExcel();
  }, [draftSave, documents]);

  const canChangeStatus = canChangeWizardStatus(
    props.policy,
    core.mode.fieldsLocked,
  );

  return {
    core,
    navigation,
    premiumCalc,
    documents,
    draftSave,
    submit,
    leave,
    gate,
    borderClassName,
    premiumPanelProps,
    carWording,
    canChangeStatus,
    exportPremiumExcel,
    ...issueHandlers,
  };
}

export type CarPolicyWizardState = ReturnType<typeof useWizardState>;
