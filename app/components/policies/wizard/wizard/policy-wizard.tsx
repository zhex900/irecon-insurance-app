import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { FormProvider, type Resolver, useForm } from "react-hook-form";

import { JustSavedProvider } from "~/components/forms/field-save-highlight";
import {
  type CarPolicyFormValues,
  carPolicySchema,
} from "~/lib/zod/policy-car";

import { PolicyPhaseProvider } from "../components/mode-context";
import { syncFormPolicyStatus } from "../hooks/composite/submit-helpers";
import { policyToFormValues } from "../shared/policy-to-values";
import type { WizardProps } from "../shared/wizard-shared";
import { WizardDefault } from "./wizard-default";

export function PolicyWizard({
  policy,
  reference,
  referenceFeeNamesPending = false,
  freshSteps = false,
  initialIsNew = false,
  clientName = "",
  noteAuthors: initialNoteAuthors,
  onPolicyUpdated,
  headerActions,
}: WizardProps) {
  const [blankInitialFields] = useState(initialIsNew);

  const form = useForm<CarPolicyFormValues>({
    resolver: zodResolver(carPolicySchema) as Resolver<CarPolicyFormValues>,
    defaultValues: {
      ...policyToFormValues(policy, clientName),
      ...(blankInitialFields
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

  useEffect(() => {
    syncFormPolicyStatus(form, policy.policyStatusId);
  }, [form, policy.policyStatusId]);

  return (
    <FormProvider {...form}>
      <JustSavedProvider>
        <PolicyPhaseProvider
          policy={policy}
          initialIsNew={initialIsNew}
          freshSteps={freshSteps}
        >
          <WizardDefault
            policy={policy}
            reference={reference}
            referenceFeeNamesPending={referenceFeeNamesPending}
            clientName={clientName}
            noteAuthors={initialNoteAuthors}
            onPolicyUpdated={onPolicyUpdated}
            headerActions={headerActions}
          />
        </PolicyPhaseProvider>
      </JustSavedProvider>
    </FormProvider>
  );
}
