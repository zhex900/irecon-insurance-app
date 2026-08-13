import { isTerminalStatus, type CarPolicyFormValues } from "~/lib/zod/policy-car";
import { useFormContext } from "react-hook-form";
import { PolicyWizardModeProvider } from "./car-policy-wizard-mode-context";
import { CarPolicyWizardInnerContent } from "./car-policy-wizard-inner-content";
import type { CarPolicyWizardProps } from "./car-policy-wizard-shared";

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
  
  const selectedStatusId = Number(form.watch("policyStatusId"));
  const isFormTerminal = isTerminalStatus(selectedStatusId);
  const policyAlreadyTerminal = isTerminalStatus(policy.policyStatusId);
  const hasSubmittedOnce = !policy.isDraft;

  return (
    <PolicyWizardModeProvider
      readOnly={readOnly}
      isNew={isNew}
      freshSteps={freshSteps}
      isFormTerminal={isFormTerminal}
      policyAlreadyTerminal={policyAlreadyTerminal}
      hasSubmittedOnce={hasSubmittedOnce}
    >
      <CarPolicyWizardInnerContent
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
    </PolicyWizardModeProvider>
  );
}
