import { useFormContext, useWatch } from "react-hook-form";

import type { Policy, ReferenceData } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

const DISPLAY_FIELDS = [
  "policyNumber",
  "coverTypeId",
  "insurerCode",
  "policyStatusId",
] as const;

export function resolveWizardDisplayFields(
  policy: Policy,
  reference: ReferenceData,
  live: {
    policyNumber?: string;
    coverTypeId?: unknown;
    insurerCode?: string;
    policyStatusId?: unknown;
  },
) {
  const selectedStatusId = Number(live.policyStatusId);
  const selectedStatus = reference.policyStatuses.find(
    (item) => item.policyStatusId === selectedStatusId,
  );
  const livePolicyNumber = live.policyNumber?.trim() || policy.policyNumber;
  const coverTypeId = Number(live.coverTypeId) || policy.car.coverTypeId;
  const coverTypeName =
    reference.coverTypes.find((item) => item.coverTypeId === coverTypeId)
      ?.name ?? "";
  const insurerCode = live.insurerCode ?? policy.insurerCode;
  const insurerName =
    reference.insurers.find((item) => item.code === insurerCode)?.name ??
    insurerCode;

  return { selectedStatus, livePolicyNumber, coverTypeName, insurerName };
}

/** Watch only the fields this leaf displays — not the whole form. */
export function useWizardDisplayFields(
  policy: Policy,
  reference: ReferenceData,
) {
  const { control } = useFormContext<CarPolicyFormValues>();
  const [policyNumber, coverTypeId, insurerCode, policyStatusId] = useWatch({
    control,
    name: DISPLAY_FIELDS,
  });
  return resolveWizardDisplayFields(policy, reference, {
    policyNumber,
    coverTypeId,
    insurerCode,
    policyStatusId,
  });
}
