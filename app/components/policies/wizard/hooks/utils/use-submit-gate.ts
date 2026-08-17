import { useState } from "react";
import { type UseFormReturn,useWatch } from "react-hook-form";

import type { PremiumBreakdown } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

export function useCarPolicyWizardSubmitGate({
  form,
  premium,
  policyPremium,
  hasSubmittedOnce,
  isFormValid,
}: {
  form: UseFormReturn<CarPolicyFormValues>;
  premium: PremiumBreakdown | undefined;
  policyPremium: PremiumBreakdown | undefined;
  hasSubmittedOnce: boolean;
  isFormValid: boolean;
}) {
  const watchedValues = useWatch({ control: form.control });
  const submitFingerprint = JSON.stringify({
    values: watchedValues,
    premium: premium ?? null,
  });
  const [submittedFingerprint, setSubmittedFingerprint] = useState(() =>
    JSON.stringify({
      values: form.getValues(),
      premium: premium ?? policyPremium ?? null,
    }),
  );
  const hasChangesSinceSubmit = submitFingerprint !== submittedFingerprint;
  const submitDisabled =
    !isFormValid || (hasSubmittedOnce && !hasChangesSinceSubmit);

  return {
    submitDisabled,
    setSubmittedFingerprint,
  };
}
