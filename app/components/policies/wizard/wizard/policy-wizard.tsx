import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, type Resolver,useForm } from "react-hook-form";

import { JustSavedProvider } from "~/components/forms/field-save-highlight";
import {
  type CarPolicyFormValues,
  carPolicySchema,
} from "~/lib/zod/policy-car";

import { policyToFormValues } from "../shared/policy-to-values";
import type { WizardProps } from "../shared/wizard-shared";
import { WizardInner } from "./wizard-inner";

export function PolicyWizard({
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
  const form = useForm<CarPolicyFormValues>({
    resolver: zodResolver(carPolicySchema) as Resolver<CarPolicyFormValues>,
    defaultValues: {
      ...policyToFormValues(policy),
      ...(isNew
        ? {
            hasExistingContractWorksCover: undefined,
            contractWorksSumInsured: undefined,
            displayHomes: undefined,
            existingStructure: undefined,
            plantEquipment: undefined,
            estimatedTurnover: undefined,
            claimsCountLast3Years: undefined,
            anyClaimsExceed20k: undefined,
            stateId: undefined,
            liabilityLimitBand: undefined,
          }
        : {}),
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  return (
    <FormProvider {...form}>
      <JustSavedProvider>
        <WizardInner
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
