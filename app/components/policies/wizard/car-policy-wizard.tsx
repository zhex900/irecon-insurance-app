import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { JustSavedProvider } from "~/components/forms/field-save-highlight";
import {
  carPolicySchema,
  type CarPolicyFormValues,
} from "~/lib/zod/policy-car";
import { CarPolicyWizardInner } from "./car-policy-wizard-inner";
import type { CarPolicyWizardProps } from "./car-policy-wizard-shared";
import { policyToFormValues } from "./policy-to-form-values";

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
  emailDirectory = [],
  emailTemplateVars,
  footerImageWidth,
  headerActions,
}: CarPolicyWizardProps) {
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
            section1DisplayHomes: undefined,
            section1ExistingStructure: undefined,
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
          emailDirectory={emailDirectory}
          emailTemplateVars={emailTemplateVars}
          footerImageWidth={footerImageWidth}
          headerActions={headerActions}
        />
      </JustSavedProvider>
    </FormProvider>
  );
}
