import { useFormContext } from "react-hook-form";

import {
  type CarPolicyFormValues,
  isTerminalStatus,
} from "~/lib/zod/policy-car";

import { ModeProvider } from "../components/mode-context";
import type { WizardProps } from "../shared/wizard-shared";
import { WizardContent as Content } from "./wizard-content";

export function WizardInner({
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
}: WizardProps) {
  const form = useFormContext<CarPolicyFormValues>();

  const selectedStatusId = Number(form.watch("policyStatusId"));
  const isFormTerminal = isTerminalStatus(selectedStatusId);
  const policyAlreadyTerminal = isTerminalStatus(policy.policyStatusId);
  // Persisted only — ModeProvider ORs this with in-session submit.
  const hasSubmittedOnce = !policy.isDraft;

  return (
    <ModeProvider
      readOnly={readOnly}
      isNew={isNew}
      freshSteps={freshSteps}
      isFormTerminal={isFormTerminal}
      policyAlreadyTerminal={policyAlreadyTerminal}
      hasSubmittedOnce={hasSubmittedOnce}
    >
      <Content
        policy={policy}
        reference={reference}
        carWording={carWording}
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
    </ModeProvider>
  );
}
