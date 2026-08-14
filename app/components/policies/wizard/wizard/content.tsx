import type { WizardProps } from "../shared/shared";
import { WizardInnerProvider, Default } from "./compound";

export function Content({
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
      <Default />
    </WizardInnerProvider>
  );
}
