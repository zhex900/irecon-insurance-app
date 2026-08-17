import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, type Resolver, useForm } from "react-hook-form";

import { JustSavedProvider } from "~/components/forms/field-save-highlight";
import {
  type CarPolicyFormValues,
  carPolicySchema,
  isTerminalStatus,
} from "~/lib/zod/policy-car";

import { ModeProvider } from "../components/mode-context";
import { policyToFormValues } from "../shared/policy-to-values";
import type { WizardProps } from "../shared/wizard-shared";
import { WizardDefault } from "./wizard-default";

export function PolicyWizard({
  policy,
  reference,
  readOnly = false,
  freshSteps = false,
  isNew = false,
  clientName = "",
  noteAuthors: initialNoteAuthors,
  onPolicyUpdated,
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

  const policyAlreadyTerminal = isTerminalStatus(policy.policyStatusId);
  // Persisted only — ModeProvider ORs this with in-session submit.
  const hasSubmittedOnce = !policy.isDraft;

  return (
    <FormProvider {...form}>
      <JustSavedProvider>
        <ModeProvider
          readOnly={readOnly}
          isNew={isNew}
          freshSteps={freshSteps}
          policyAlreadyTerminal={policyAlreadyTerminal}
          hasSubmittedOnce={hasSubmittedOnce}
        >
          <WizardDefault
            policy={policy}
            reference={reference}
            clientName={clientName}
            noteAuthors={initialNoteAuthors}
            onPolicyUpdated={onPolicyUpdated}
            headerActions={headerActions}
          />
        </ModeProvider>
      </JustSavedProvider>
    </FormProvider>
  );
}
