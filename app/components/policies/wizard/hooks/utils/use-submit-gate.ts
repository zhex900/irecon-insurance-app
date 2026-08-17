import { useState } from "react";

import type { PremiumBreakdown } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

function submitFingerprint(
  values: CarPolicyFormValues,
  premium: PremiumBreakdown | null | undefined,
) {
  return JSON.stringify({
    values,
    premium: premium ?? null,
  });
}

export function useCarPolicyWizardSubmitGate({
  values,
  premium,
  policyPremium,
  hasSubmittedOnce,
  isFormValid,
}: {
  values: CarPolicyFormValues;
  premium: PremiumBreakdown | undefined;
  policyPremium: PremiumBreakdown | undefined;
  hasSubmittedOnce: boolean;
  isFormValid: boolean;
}) {
  const currentFingerprint = submitFingerprint(values, premium);
  const [submittedFingerprint, setSubmittedFingerprint] = useState(() =>
    submitFingerprint(values, premium ?? policyPremium),
  );
  const hasChangesSinceSubmit = currentFingerprint !== submittedFingerprint;
  const submitDisabled =
    !isFormValid || (hasSubmittedOnce && !hasChangesSinceSubmit);

  return {
    submitDisabled,
    setSubmittedFingerprint,
  };
}
