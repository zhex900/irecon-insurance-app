import type { WizardProps } from "../shared/wizard-shared";
import { WizardInnerProvider } from "./provider";
import { WizardDefault } from "./wizard-default";

export function WizardContent({
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
}: Omit<WizardProps, "readOnly" | "isNew" | "freshSteps">) {
  return (
    <WizardInnerProvider
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
      <WizardDefault />
    </WizardInnerProvider>
  );
}
