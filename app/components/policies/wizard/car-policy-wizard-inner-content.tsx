import type { CarPolicyWizardProps } from "./car-policy-wizard-shared";
import { CarPolicyWizardInnerCompound } from "./car-policy-wizard-inner-compound";

export function CarPolicyWizardInnerContent({
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
}: Omit<CarPolicyWizardProps, 'readOnly' | 'isNew' | 'freshSteps'>) {

  return (
    <CarPolicyWizardInnerCompound.Provider
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
    >
      <CarPolicyWizardInnerCompound.Default />
    </CarPolicyWizardInnerCompound.Provider>
  );
}